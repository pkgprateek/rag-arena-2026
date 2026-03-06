"""RAG Arena 2026 — Vector & Keyword Store using ChromaDB.

Hybrid store: ChromaDB for dense vector search + in-memory BM25 for sparse keyword search.

Document scoping:
  - GLOBAL docs: indexed for all sessions (scope="global")
  - SESSION docs: indexed per-session, only visible within that session_id
"""

import math
from collections import Counter
from dataclasses import dataclass, field
import logging
from typing import Literal
from urllib.parse import urlparse

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.services.ingestion.chunkers import Chunk

logger = logging.getLogger(__name__)


@dataclass
class Document:
    """An uploaded and indexed document."""

    id: str
    filename: str
    chunks: list[Chunk] = field(default_factory=list)
    total_chars: int = 0
    scope: Literal["global", "session"] = "global"
    session_id: str = ""  # populated when scope="session"
    source_ext: str = ""
    source_path: str = ""


def _tokenize(text: str) -> list[str]:
    import re

    return re.findall(r"[a-z0-9]+", text.lower())


class MultiIndexStore:
    """Hybrid store using ChromaDB for Dense Vectors and in-memory dicts for Sparse (BM25)."""

    def __init__(self) -> None:
        self._chunks: dict[str, Chunk] = {}
        self._docs: dict[str, Document] = {}

        # Sparse (BM25) sidecar state
        self._df: Counter[str] = Counter()
        self._n_docs: int = 0

        # Initialize ChromaDB
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
        except Exception as e:
            logger.warning(
                "Could not connect to ChromaDB at %s:%s — vector search disabled. Error: %s",
                host,
                port,
                e,
            )
            self._collection = None

    @property
    def total_chunks(self) -> int:
        return len(self._chunks)

    @property
    def total_docs(self) -> int:
        return len(self._docs)

    def add_document(self, doc: Document) -> None:
        """Index a document's chunks in both ChromaDB and the BM25 sidecar."""
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

            # Sanitize metadata — Chroma does not store nested dicts/lists
            clean_meta: dict = {}
            for k, v in chunk.metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                else:
                    clean_meta[k] = str(v)

            clean_meta["doc_id"] = chunk.doc_id
            clean_meta["page"] = chunk.page
            # Tier extracted from doc_id suffix: e.g. "abc_starter" → "starter"
            clean_meta["tier"] = (
                chunk.doc_id.rsplit("_", 1)[-1] if "_" in chunk.doc_id else "unknown"
            )
            # Scope fields for session-aware filtering
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
            except Exception as e:
                logger.error("Failed to upsert chunks to ChromaDB: %s", e)

    def remove_document(self, doc_id: str) -> None:
        """Remove a document and all its chunks from both indices."""
        doc = self._docs.pop(doc_id, None)
        if not doc:
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
            except Exception as e:
                logger.error("Failed to delete chunks from ChromaDB: %s", e)

    def _build_where_clause(
        self,
        tier_filter: str | None = None,
        session_id: str = "",
    ) -> dict | None:
        """Build Chroma $and/$or where clause for tier + scope filtering.

        Logic: return chunks that match the tier AND are either global OR
        belong to the requesting session.
        """
        conditions: list[dict] = []

        if tier_filter:
            conditions.append({"tier": {"$eq": tier_filter}})

        # Scope: include global docs always; include session docs only if session matches
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
            # No session context → only global docs
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
        """Dense vector search via ChromaDB with tier + scope filtering."""
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
                        # Convert L2 distance → similarity score [0, 1]
                        similarity = max(0.0, 1.0 - (distance / 2.0))
                        retrieved.append((self._chunks[chunk_id], similarity))

            return retrieved

        except Exception as e:
            logger.error("ChromaDB vector search failed: %s", e)
            return []

    def keyword_search(
        self,
        query: str,
        top_k: int = 5,
        tier_filter: str | None = None,
        session_id: str = "",
    ) -> list[tuple[Chunk, float]]:
        """BM25 in-memory sparse keyword search with tier + scope filtering."""
        if not self._chunks:
            return []

        query_tokens = set(_tokenize(query))
        if not query_tokens:
            return []

        results: list[tuple[Chunk, float]] = []
        for chunk in self._chunks.values():
            # Tier filter: chunk doc_id ends with "_<tier>"
            if tier_filter and not chunk.doc_id.endswith(f"_{tier_filter}"):
                continue

            # Scope filter: use the parent document's scope metadata
            doc = self._docs.get(chunk.doc_id, None)
            if doc is None:
                # Try resolving via chunk's own doc_id
                # Fallback: search all if doc metadata lost (shouldn't happen normally)
                pass
            else:
                if doc.scope == "session" and doc.session_id != session_id:
                    continue  # Session doc not visible to this session

            chunk_tokens = _tokenize(chunk.content)
            token_counts = Counter(chunk_tokens)

            score = 0.0
            for token in query_tokens:
                if token in token_counts:
                    tf = token_counts[token]
                    idf = math.log((self._n_docs + 1) / (self._df.get(token, 0) + 1))
                    # BM25-lite: simplified TF-IDF with saturation
                    score += idf * (tf * 2.5) / (tf + 1.5)

            if score > 0:
                results.append((chunk, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def get_stats(self) -> dict:
        chroma_count = 0
        if self._collection:
            try:
                chroma_count = self._collection.count()
            except Exception:
                pass

        return {
            "total_docs": self.total_docs,
            "total_python_chunks": self.total_chunks,
            "total_chroma_chunks": chroma_count,
            "vocabulary_size": len(self._df),
            "chroma_connected": self._collection is not None,
        }


store = MultiIndexStore()
