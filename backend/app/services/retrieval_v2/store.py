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
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import DBDocument, DBDocumentTierState
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

    async def recover_persisted_documents(self) -> None:
        """Reload persisted document metadata after process startup."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DBDocument)
                .options(selectinload(DBDocument.tier_states))
                .where(DBDocument.source_status == "persisted")
                .order_by(DBDocument.scope.asc(), DBDocument.filename.asc(), DBDocument.id.asc())
            )
            documents = result.scalars().all()

            needs_commit = False
            for document in documents:
                for tier_state in document.tier_states:
                    if tier_state.status == DocTierState.PROCESSING.value:
                        tier_state.status = DocTierState.QUEUED.value
                        tier_state.chunks = 0
                        tier_state.error_text = None
                        needs_commit = True
            if needs_commit:
                await session.commit()

        self._tracked_docs = {
            document.id: self._tracked_from_db_document(document)
            for document in documents
        }

    async def register_document(
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
        async with AsyncSessionLocal() as session:
            document = await self._load_document(session, doc_id)
            if document is None:
                document = DBDocument(
                    id=doc_id,
                    scope=scope,
                    session_id=session_id or None,
                    filename=filename,
                    source_ext=source_ext,
                    source_path=source_path,
                    total_chars=total_chars,
                    content_hash=doc_id.split("-", 1)[-1],
                    source_status="persisted",
                )
                session.add(document)
            else:
                document.scope = scope
                document.session_id = session_id or None
                document.filename = filename
                document.source_ext = source_ext
                document.source_path = source_path
                document.total_chars = total_chars
                document.source_status = "persisted"

            self._ensure_tier_rows(document)
            await session.commit()

            refreshed = await self._load_document(session, doc_id)
            if refreshed is None:
                raise RuntimeError(f"Failed to reload document '{doc_id}' after registration")

        tracked = self._tracked_from_db_document(refreshed)
        self._tracked_docs[doc_id] = tracked
        return tracked

    async def get_tracked_document(self, doc_id: str) -> TrackedDocument | None:
        async with AsyncSessionLocal() as session:
            document = await self._load_document(session, doc_id)
        if document is None or document.source_status != "persisted":
            return None
        tracked = self._tracked_from_db_document(document)
        self._tracked_docs[doc_id] = tracked
        return tracked

    async def list_tracked_documents(self, session_id: str = "") -> list[TrackedDocument]:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(DBDocument)
                .options(selectinload(DBDocument.tier_states))
                .where(DBDocument.source_status == "persisted")
            )
            if session_id:
                stmt = stmt.where(
                    (DBDocument.scope == "global") | (DBDocument.session_id == session_id)
                )
            else:
                stmt = stmt.where(DBDocument.scope == "global")
            stmt = stmt.order_by(
                DBDocument.scope.asc(),
                DBDocument.filename.asc(),
                DBDocument.id.asc(),
            )
            result = await session.execute(stmt)
            documents = result.scalars().all()

        visible = [self._tracked_from_db_document(document) for document in documents]
        for tracked in visible:
            self._tracked_docs[tracked.doc_id] = tracked
        return visible

    async def count_ready_documents(self, tier: Tier, session_id: str = "") -> int:
        tracked_docs = await self.list_tracked_documents(session_id)
        return sum(
            1
            for tracked in tracked_docs
            if tracked.tier_states.get(tier) == DocTierState.READY
        )

    def get_tier_task(self, doc_id: str, tier: Tier) -> asyncio.Task[None] | None:
        task = self._tier_tasks.get((doc_id, tier))
        if task is not None and task.done():
            self._tier_tasks.pop((doc_id, tier), None)
            return None
        return task

    def has_indexed_document(self, doc_id: str, tier: Tier) -> bool:
        return f"{doc_id}_{tier.value}" in self._docs

    def start_tier_ingestion(
        self,
        doc_id: str,
        tier: Tier,
        *,
        force: bool = False,
    ) -> asyncio.Task[None] | None:
        tracked = self._tracked_docs.get(doc_id)
        if tracked is None or tracked.source_status != "persisted":
            return None

        existing = self.get_tier_task(doc_id, tier)
        if existing is not None:
            return existing

        state = tracked.tier_states.get(tier, DocTierState.QUEUED)
        if state == DocTierState.READY and self.has_indexed_document(doc_id, tier) and not force:
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
            tracked = await self.get_tracked_document(doc_id)
        if tracked is None:
            return

        await self.set_tier_state(doc_id, tier, DocTierState.PROCESSING)

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
            await self.set_tier_state(
                doc_id,
                tier,
                DocTierState.READY,
                chunks=len(chunks),
            )
        except asyncio.CancelledError:
            await self.set_tier_state(doc_id, tier, DocTierState.QUEUED)
            raise
        except Exception as exc:
            logger.exception("Failed tier ingestion for %s (%s)", doc_id, tier.value)
            await self.set_tier_state(
                doc_id,
                tier,
                DocTierState.ERROR,
                error=str(exc)[:300],
            )
        finally:
            self._tier_tasks.pop((doc_id, tier), None)

    async def set_tier_state(
        self,
        doc_id: str,
        tier: Tier,
        status: DocTierState,
        *,
        chunks: int = 0,
        error: str | None = None,
    ) -> TrackedDocument | None:
        async with AsyncSessionLocal() as session:
            document = await self._load_document(session, doc_id)
            if document is None:
                return None
            self._ensure_tier_rows(document)
            tier_row = next(
                (row for row in document.tier_states if row.tier == tier.value),
                None,
            )
            if tier_row is None:
                tier_row = DBDocumentTierState(document_id=doc_id, tier=tier.value)
                document.tier_states.append(tier_row)

            tier_row.status = status.value
            tier_row.chunks = chunks
            tier_row.error_text = error
            await session.commit()

            refreshed = await self._load_document(session, doc_id)
            if refreshed is None:
                return None

        tracked = self._tracked_from_db_document(refreshed)
        self._tracked_docs[doc_id] = tracked
        return tracked

    async def delete_tracked_document(self, doc_id: str) -> TrackedDocument | None:
        async with AsyncSessionLocal() as session:
            document = await self._load_document(session, doc_id)
            if document is None or document.source_status != "persisted":
                return None

            tracked = self._tracked_from_db_document(document)
            await session.execute(
                delete(DBDocumentTierState).where(DBDocumentTierState.document_id == doc_id)
            )
            await session.execute(delete(DBDocument).where(DBDocument.id == doc_id))
            await session.commit()

        for tier in Tier:
            task = self._tier_tasks.pop((doc_id, tier), None)
            if task is not None:
                task.cancel()
            self._remove_indexed_document(f"{doc_id}_{tier.value}")
        self._tracked_docs.pop(doc_id, None)
        return tracked

    async def delete_session_documents(self, session_id: str) -> list[TrackedDocument]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DBDocument)
                .options(selectinload(DBDocument.tier_states))
                .where(DBDocument.scope == "session")
                .where(DBDocument.session_id == session_id)
                .where(DBDocument.source_status == "persisted")
            )
            documents = result.scalars().all()

        deleted: list[TrackedDocument] = []
        for document in documents:
            tracked = await self.delete_tracked_document(document.id)
            if tracked is not None:
                deleted.append(tracked)
        return deleted

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

    def list_indexed_chunks(
        self,
        tier: Tier,
        session_id: str = "",
    ) -> list[Chunk]:
        """Return indexed chunks visible to the given session for a tier."""
        visible_docs: list[Document] = []

        for doc in self._docs.values():
            if not doc.id.endswith(f"_{tier.value}"):
                continue

            if session_id:
                if doc.scope == "session" and doc.session_id != session_id:
                    continue
            elif doc.scope != "global":
                continue

            visible_docs.append(doc)

        visible_docs.sort(key=lambda doc: (doc.scope, doc.filename, doc.id))

        chunks: list[Chunk] = []
        for doc in visible_docs:
            chunks.extend(sorted(doc.chunks, key=lambda chunk: (chunk.page, chunk.id)))

        return chunks

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

    async def _load_document(
        self,
        session,
        doc_id: str,
    ) -> DBDocument | None:
        result = await session.execute(
            select(DBDocument)
            .options(selectinload(DBDocument.tier_states))
            .where(DBDocument.id == doc_id)
        )
        return result.scalar_one_or_none()

    def _ensure_tier_rows(self, document: DBDocument) -> None:
        existing_tiers = {row.tier for row in document.tier_states}
        for tier in Tier:
            if tier.value in existing_tiers:
                continue
            document.tier_states.append(
                DBDocumentTierState(
                    document_id=document.id,
                    tier=tier.value,
                    status=DocTierState.QUEUED.value,
                    chunks=0,
                    error_text=None,
                )
            )

    def _tracked_from_db_document(self, document: DBDocument) -> TrackedDocument:
        tier_states = {tier: DocTierState.QUEUED for tier in Tier}
        chunks_by_tier = {tier: 0 for tier in Tier}
        error_by_tier: dict[Tier, str] = {}

        for tier_row in document.tier_states:
            try:
                tier = Tier(tier_row.tier)
                status = DocTierState(tier_row.status)
            except ValueError:
                continue
            tier_states[tier] = status
            chunks_by_tier[tier] = tier_row.chunks
            if tier_row.error_text:
                error_by_tier[tier] = tier_row.error_text

        return TrackedDocument(
            doc_id=document.id,
            filename=document.filename,
            total_chars=document.total_chars,
            scope=document.scope,
            session_id=document.session_id or "",
            source_ext=document.source_ext,
            source_path=document.source_path,
            source_status=document.source_status,
            tier_states=tier_states,
            chunks_by_tier=chunks_by_tier,
            error_by_tier=error_by_tier,
        )


store = MultiIndexStore()
