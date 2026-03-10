"""RAG Arena 2026 — Document upload and management route.

Upload strategy:
  ✓ EAGER: Only Tier.STARTER ingestion runs at upload time (pure local, zero external API calls)
  ✓ LAZY: Tiers PLUS/ENTERPRISE/MODERN ingest on first query by ensure_tier_indexed()
           called from the LLM pipeline before retrieval.

Document scoping:
  - scope=global (default): document available across all sessions
  - scope=session: document available only within the uploading session_id
"""

from __future__ import annotations

import logging
import hashlib
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, HTTPException, UploadFile, Query

from app.config import settings
from app.models import DocScope, Tier
from app.services.ingestion.pipeline import ingest_document
from app.services.retrieval_v2.store import store as vector_store, Document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docs", tags=["docs"])

# Max upload size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".pdf", ".docx", ".doc"}


def _persist_source_file(doc_id: str, ext: str, content_bytes: bytes) -> str:
    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    suffix = ext if ext else ".bin"
    file_path = uploads_dir / f"{doc_id}{suffix}"
    file_path.write_bytes(content_bytes)
    return str(file_path)


@router.post("/upload")
async def upload_doc(
    file: UploadFile,
    scope: Annotated[DocScope, Query()] = DocScope.GLOBAL,
    session_id: Annotated[str, Query()] = "",
) -> dict:
    """Accept a document upload. Immediately indexes for Tier.STARTER only.

    Higher tiers (PLUS/ENTERPRISE/MODERN) are indexed lazily on first query —
    this avoids any Unstructured API or LLM calls at upload time.

    Args:
        scope:      "global" (all sessions) or "session" (this session only)
        session_id: Required when scope="session"
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    if scope == DocScope.SESSION and not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required when scope=session",
        )

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content_bytes = await file.read()

    if len(content_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(content_bytes):,} bytes). Max: {MAX_FILE_SIZE:,} bytes",
        )

    if len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    doc_id = hashlib.sha256(content_bytes).hexdigest()[:16]
    source_path = _persist_source_file(doc_id, ext, content_bytes)

    # Idempotency: check if already indexed for Starter tier
    starter_doc_id = f"{doc_id}_{Tier.STARTER.value}"
    if starter_doc_id in vector_store._docs:
        existing = vector_store._docs[starter_doc_id]
        return {
            "doc_id": doc_id,
            "filename": existing.filename,
            "chunks": len(existing.chunks),
            "total_chars": existing.total_chars,
            "scope": existing.scope,
            "session_id": existing.session_id,
            "status": "already_indexed",
            "indexed_tiers": [Tier.STARTER.value],
            "store_stats": vector_store.get_stats(),
        }

    # --- EAGER: Index only Starter tier (pure local, no external API calls) ---
    try:
        chunks = await ingest_document(
            file_bytes=content_bytes,
            filename=file.filename,
            ext=ext,
            doc_id=starter_doc_id,
            tier=Tier.STARTER,
        )
    except Exception as e:
        logger.exception("Error parsing file '%s'", file.filename)
        raise HTTPException(status_code=400, detail=f"Could not parse document: {e}")

    if not chunks:
        raise HTTPException(
            status_code=400, detail="File is empty or could not be chunked"
        )

    doc = Document(
        id=starter_doc_id,
        filename=file.filename,
        chunks=chunks,
        total_chars=len(content_bytes),
        scope=scope.value,
        session_id=session_id if scope == DocScope.SESSION else "",
        source_ext=ext,
        source_path=source_path,
    )
    vector_store.add_document(doc)

    logger.info(
        "Indexed '%s' for Tier.STARTER (%d chunks, scope=%s). "
        "Higher tiers will be indexed lazily on first query.",
        file.filename,
        len(chunks),
        scope.value,
    )

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "chunks": len(chunks),
        "total_chars": len(content_bytes),
        "scope": scope.value,
        "session_id": session_id if scope == DocScope.SESSION else "",
        "status": "indexed",
        "indexed_tiers": [Tier.STARTER.value],
        "note": "Higher tiers (plus/enterprise/modern) will index on first query for that tier.",
        "store_stats": vector_store.get_stats(),
    }


@router.get("/list")
async def list_docs() -> dict:
    """List all indexed documents (deduped across tiers)."""
    docs = []
    seen_ids: set[str] = set()

    for doc in vector_store._docs.values():
        # Strip tier suffix to get base doc_id
        base_id = doc.id.rsplit("_", 1)[0]
        if base_id in seen_ids:
            continue
        seen_ids.add(base_id)

        docs.append(
            {
                "doc_id": base_id,
                "filename": doc.filename,
                "chunks": len(doc.chunks),
                "total_chars": doc.total_chars,
                "scope": doc.scope,
                "session_id": doc.session_id,
            }
        )

    return {
        "documents": docs,
        "store_stats": vector_store.get_stats(),
    }


@router.post("/load-sample")
async def load_sample() -> dict:
    """Load the built-in sample corpus (RAG reference guide) for Starter tier."""
    from app.utils.sample_corpus import get_sample_corpus_bytes

    content_bytes = get_sample_corpus_bytes()
    doc_id = "sample_rag_guide"
    source_path = _persist_source_file(doc_id, ".md", content_bytes)
    starter_doc_id = f"{doc_id}_{Tier.STARTER.value}"

    if starter_doc_id in vector_store._docs:
        existing = vector_store._docs[starter_doc_id]
        return {
            "doc_id": doc_id,
            "filename": existing.filename,
            "chunks": len(existing.chunks),
            "total_chars": existing.total_chars,
            "status": "already_loaded",
            "store_stats": vector_store.get_stats(),
        }

    chunks = await ingest_document(
        file_bytes=content_bytes,
        filename="RAG Guide (Built-in Sample)",
        ext=".md",
        doc_id=starter_doc_id,
        tier=Tier.STARTER,
    )

    doc = Document(
        id=starter_doc_id,
        filename="RAG Guide (Built-in Sample)",
        chunks=chunks,
        total_chars=len(content_bytes),
        scope="global",
        source_ext=".md",
        source_path=source_path,
    )
    vector_store.add_document(doc)

    return {
        "doc_id": doc_id,
        "filename": "RAG Guide (Built-in Sample)",
        "chunks": len(chunks),
        "total_chars": len(content_bytes),
        "status": "loaded",
        "indexed_tiers": [Tier.STARTER.value],
        "store_stats": vector_store.get_stats(),
    }


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str) -> dict:
    """Remove a document from the index across all tiers."""
    found = False
    source_paths: set[str] = set()
    for tier in Tier:
        tier_doc_id = f"{doc_id}_{tier.value}"
        if tier_doc_id in vector_store._docs:
            source_path = vector_store._docs[tier_doc_id].source_path
            if source_path:
                source_paths.add(source_path)
            vector_store.remove_document(tier_doc_id)
            found = True

    if not found:
        raise HTTPException(status_code=404, detail="Document not found")

    for source_path in source_paths:
        try:
            Path(source_path).unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to delete source file '%s'", source_path)

    return {
        "doc_id": doc_id,
        "status": "deleted",
        "store_stats": vector_store.get_stats(),
    }
