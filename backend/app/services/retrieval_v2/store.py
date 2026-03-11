"""RAG Arena 2026 — Vector store plus tracked document registry."""

from __future__ import annotations

import asyncio
import math
from collections import Counter
from dataclasses import dataclass, field
import logging
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.models import DocTierState, Tier
from app.services.ingestion.chunkers import Chunk
from app.services.ingestion.pipeline import ingest_document

logger = logging.getLogger(__name__)


@dataclass
class Document:
    """A tier-indexed document variant stored in retrieval indices."""

    id: str
    filename: str
    chunks: list[Chunk] = field(default_factory=list)
    total_chars: int = 0
    scope: Literal["global", "session"] = "global"
    session_id: str = ""
    source_ext: str = ""
    source_path: str = ""


@dataclass
class TrackedDocument:
    """Source-level document registry entry used by the docs API and pipeline."""

    doc_id: str
    filename: str
    total_chars: int
    scope: Literal["global", "session"]
    session_id: str = ""
    source_ext: str = ""
    source_path: str = ""
    source_status: Literal["persisted", "deleted"] = "persisted"
    tier_states: dict[Tier, DocTierState] = field(default_factory=dict)
    chunks_by_tier: dict[Tier, int] = field(default_factory=dict)
    error_by_tier: dict[Tier, str] = field(default_factory=dict)


def _tokenize(text: str) -> list[str]:
    import re

    return re.findall(r"[a-z0-9]+", text.lower())


class MultiIndexStore:
    """Hybrid dense/sparse retrieval store with tracked source documents."""

    def __init__(self) -> None:
        self._chunks: dict[str, Chunk] = {}
        self._docs: dict[str, Document] = {}
        self._tracked_docs: dict[str, TrackedDocument] = {}
        self._tier_tasks: dict[tuple[str, Tier], asyncio.Task[None]] = {}

        self._df: Counter[str] = Counter()
        self._n_docs: int = 0

        parsed_url = urlparse(settings.chroma_url)
        host = parsed_url.hostname or "localhost"
        port = parsed_url.port or 8000

        try:
            self._chroma_client = chromadb.HttpClient(
                host=host,
                port=port,
                settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False),
            )
            self._collection = self._chroma_client.get_or_create_collection(
                name="rag_arena"
            )
            logger.info("Connected to ChromaDB at %s:%s", host, port)
        except Exception as exc:
            logger.warning(
                "Could not connect to ChromaDB at %s:%s — vector search disabled. Error: %s",
                host,
                port,
                exc,
            )
            self._collection = None

    @property
    def total_chunks(self) -> int:
        return len(self._chunks)

    @property
    def total_docs(self) -> int:
        return len(self._tracked_docs)

    def register_document(
        self,
        *,
        doc_id: str,
        filename: str,
        total_chars: int,
        scope: Literal["global", "session"],
        session_id: str = "",
        source_ext: str = "",
        source_path: str = "",
    ) -> TrackedDocument:
        tracked = self._tracked_docs.get(doc_id)
        if tracked is None:
            tracked = TrackedDocument(
                doc_id=doc_id,
                filename=filename,
                total_chars=total_chars,
                scope=scope,
                session_id=session_id,
                source_ext=source_ext,
                source_path=source_path,
                tier_states={tier: DocTierState.QUEUED for tier in Tier},
            )
            self._tracked_docs[doc_id] = tracked
            return tracked

        tracked.filename = filename
        tracked.total_chars = total_chars
        tracked.scope = scope
        tracked.session_id = session_id
        tracked.source_ext = source_ext
        tracked.source_path = source_path
        tracked.source_status = "persisted"
        for tier in Tier:
            tracked.tier_states.setdefault(tier, DocTierState.QUEUED)
        return tracked

    def get_tracked_document(self, doc_id: str) -> TrackedDocument | None:
        return self._tracked_docs.get(doc_id)

    def list_tracked_documents(self, session_id: str = "") -> list[TrackedDocument]:
        visible: list[TrackedDocument] = []
        for tracked in self._tracked_docs.values():
            if tracked.source_status != "persisted":
                continue
            if tracked.scope == "global" or tracked.session_id == session_id:
                visible.append(tracked)
        visible.sort(key=lambda tracked: (tracked.scope, tracked.filename.lower(), tracked.doc_id))
        return visible

    def get_tier_task(self, doc_id: str, tier: Tier) -> asyncio.Task[None] | None:
        task = self._tier_tasks.get((doc_id, tier))
        if task is not None and task.done():
            self._tier_tasks.pop((doc_id, tier), None)
            return None
        return task

    def start_tier_ingestion(self, doc_id: str, tier: Tier) -> asyncio.Task[None] | None:
        tracked = self._tracked_docs.get(doc_id)
        if tracked is None or tracked.source_status != "persisted":
            return None

        existing = self.get_tier_task(doc_id, tier)
        if existing is not None:
            return existing

        state = tracked.tier_states.get(tier, DocTierState.QUEUED)
        if state == DocTierState.READY:
            return None

        task = asyncio.create_task(self._run_tier_ingestion(doc_id, tier))
        self._tier_tasks[(doc_id, tier)] = task
        return task

    def start_global_ingestion_sequence(
        self, doc_id: str, active_tier: Tier
    ) -> asyncio.Task[None] | None:
        tracked = self._tracked_docs.get(doc_id)
        if tracked is None or tracked.scope != "global":
            return None
        return asyncio.create_task(self._run_global_ingestion_sequence(doc_id, active_tier))

    async def _run_global_ingestion_sequence(self, doc_id: str, active_tier: Tier) -> None:
        task = self.start_tier_ingestion(doc_id, active_tier)
        if task is not None:
            await task

        for tier in Tier:
            if tier == active_tier:
                continue
            next_task = self.start_tier_ingestion(doc_id, tier)
            if next_task is not None:
                await next_task

    async def _run_tier_ingestion(self, doc_id: str, tier: Tier) -> None:
        tracked = self._tracked_docs.get(doc_id)
        if tracked is None:
            return

        tracked.tier_states[tier] = DocTierState.PROCESSING
        tracked.error_by_tier.pop(tier, None)

        try:
            file_bytes = Path(tracked.source_path).read_bytes()
            tier_doc_id = f"{doc_id}_{tier.value}"
            existing = self._docs.get(tier_doc_id)
            if existing is not None:
                self._remove_indexed_document(tier_doc_id)

            chunks = await ingest_document(
                file_bytes=file_bytes,
                filename=tracked.filename,
                ext=tracked.source_ext,
                doc_id=tier_doc_id,
                tier=tier,
            )
            if not chunks:
                raise ValueError("File is empty or could not be chunked")

            indexed = Document(
                id=tier_doc_id,
                filename=tracked.filename,
                chunks=chunks,
                total_chars=tracked.total_chars,
                scope=tracked.scope,
                session_id=tracked.session_id,
                source_ext=tracked.source_ext,
                source_path=tracked.source_path,
            )
            self._add_indexed_document(indexed)
            tracked.chunks_by_tier[tier] = len(chunks)
            tracked.tier_states[tier] = DocTierState.READY
        except asyncio.CancelledError:
            tracked.tier_states[tier] = DocTierState.QUEUED
            raise
        except Exception as exc:
            logger.exception("Failed tier ingestion for %s (%s)", doc_id, tier.value)
            tracked.tier_states[tier] = DocTierState.ERROR
            tracked.error_by_tier[tier] = str(exc)[:300]
            tracked.chunks_by_tier[tier] = 0
        finally:
            self._tier_tasks.pop((doc_id, tier), None)

    def count_ready_documents(self, tier: Tier, session_id: str = "") -> int:
        return sum(
            1
            for tracked in self.list_tracked_documents(session_id)
            if tracked.tier_states.get(tier) == DocTierState.READY
        )

    def delete_tracked_document(self, doc_id: str) -> bool:
        tracked = self._tracked_docs.pop(doc_id, None)
        if tracked is None:
            return False

        for tier in Tier:
            task = self._tier_tasks.pop((doc_id, tier), None)
            if task is not None:
                task.cancel()
            self._remove_indexed_document(f"{doc_id}_{tier.value}")
        tracked.source_status = "deleted"
        return True

    def _add_indexed_document(self, doc: Document) -> None:
        self._docs[doc.id] = doc

        chroma_ids: list[str] = []
        chroma_documents: list[str] = []
        chroma_metadatas: list[dict] = []

        for chunk in doc.chunks:
            self._chunks[chunk.id] = chunk
            self._n_docs += 1

            tokens = _tokenize(chunk.content)
            for token in set(tokens):
                self._df[token] += 1

            chroma_ids.append(chunk.id)
            chroma_documents.append(chunk.content)

            clean_meta: dict[str, str | int | float | bool] = {}
            for key, value in chunk.metadata.items():
                if isinstance(value, (str, int, float, bool)):
                    clean_meta[key] = value
                else:
                    clean_meta[key] = str(value)

            clean_meta["doc_id"] = chunk.doc_id
            clean_meta["page"] = chunk.page
            clean_meta["tier"] = chunk.doc_id.rsplit("_", 1)[-1]
            clean_meta["scope"] = doc.scope
            clean_meta["session_id"] = doc.session_id
            chroma_metadatas.append(clean_meta)

        if self._collection and chroma_ids:
            try:
                self._collection.upsert(
                    ids=chroma_ids,
                    documents=chroma_documents,
                    metadatas=chroma_metadatas,
                )
            except Exception as exc:
                logger.error("Failed to upsert chunks to ChromaDB: %s", exc)

    def _remove_indexed_document(self, doc_id: str) -> None:
        doc = self._docs.pop(doc_id, None)
        if doc is None:
            return

        chunk_ids_to_remove: list[str] = []
        for chunk in doc.chunks:
            chunk_ids_to_remove.append(chunk.id)
            self._chunks.pop(chunk.id, None)
            self._n_docs -= 1
            for token in set(_tokenize(chunk.content)):
                self._df[token] -= 1
                if self._df[token] <= 0:
                    del self._df[token]

        if self._collection and chunk_ids_to_remove:
            try:
                self._collection.delete(ids=chunk_ids_to_remove)
            except Exception as exc:
                logger.error("Failed to delete chunks from ChromaDB: %s", exc)

    def _build_where_clause(
        self,
        tier_filter: str | None = None,
        session_id: str = "",
    ) -> dict | None:
        conditions: list[dict] = []

        if tier_filter:
            conditions.append({"tier": {"$eq": tier_filter}})

        if session_id:
            conditions.append(
                {
                    "$or": [
                        {"scope": {"$eq": "global"}},
                        {"session_id": {"$eq": session_id}},
                    ]
                }
            )
        else:
            conditions.append({"scope": {"$eq": "global"}})

        if not conditions:
            return None
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}

    def vector_search(
        self,
        query: str,
        top_k: int = 5,
        tier_filter: str | None = None,
        session_id: str = "",
    ) -> list[tuple[Chunk, float]]:
        if not self._collection or not self._chunks:
            return []

        try:
            where = self._build_where_clause(tier_filter, session_id)
            results = self._collection.query(
                query_texts=[query],
                n_results=min(top_k, max(1, self.total_chunks)),
                where=where,
            )

            retrieved: list[tuple[Chunk, float]] = []
            if results["ids"] and results["ids"][0]:
                for idx, chunk_id in enumerate(results["ids"][0]):
                    if chunk_id in self._chunks:
                        distance = results["distances"][0][idx]
                        similarity = max(0.0, 1.0 - (distance / 2.0))
                        retrieved.append((self._chunks[chunk_id], similarity))
            return retrieved
        except Exception as exc:
            logger.error("ChromaDB vector search failed: %s", exc)
            return []

    def keyword_search(
        self,
        query: str,
        top_k: int = 5,
        tier_filter: str | None = None,
        session_id: str = "",
    ) -> list[tuple[Chunk, float]]:
        if not self._chunks:
            return []

        query_tokens = set(_tokenize(query))
        if not query_tokens:
            return []

        results: list[tuple[Chunk, float]] = []
        for chunk in self._chunks.values():
            if tier_filter and not chunk.doc_id.endswith(f"_{tier_filter}"):
                continue

            doc = self._docs.get(chunk.doc_id)
            if doc is not None and doc.scope == "session" and doc.session_id != session_id:
                continue

            chunk_tokens = _tokenize(chunk.content)
            token_counts = Counter(chunk_tokens)
            score = 0.0
            for token in query_tokens:
                if token in token_counts:
                    tf = token_counts[token]
                    idf = math.log((self._n_docs + 1) / (self._df.get(token, 0) + 1))
                    score += idf * (tf * 2.5) / (tf + 1.5)

            if score > 0:
                results.append((chunk, score))

        results.sort(key=lambda result: result[1], reverse=True)
        return results[:top_k]

    def get_stats(self) -> dict:
        chroma_count = 0
        if self._collection:
            try:
                chroma_count = self._collection.count()
            except Exception:
                pass

        return {
            "tracked_docs": len(self._tracked_docs),
            "total_python_chunks": self.total_chunks,
            "total_chroma_chunks": chroma_count,
            "vocabulary_size": len(self._df),
            "processing_tasks": len(self._tier_tasks),
            "chroma_connected": self._collection is not None,
        }


store = MultiIndexStore()
