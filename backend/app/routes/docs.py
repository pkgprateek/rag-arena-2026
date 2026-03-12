"""RAG Arena 2026 — Document upload and management route."""

from __future__ import annotations

import logging
import hashlib
from pathlib import Path
from typing import Annotated
from fastapi import APIRouter, HTTPException, UploadFile, Query

from app.config import settings
from app.models import DocListItem, DocScope, DocsListResponse, DocTierStateInfo, DocUploadResponse, Tier
from app.services.retrieval_v2.store import store as vector_store

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
    active_tier: Annotated[Tier, Query()] = Tier.STARTER,
) -> DocUploadResponse:
    """Accept a document upload and register it for tier-aware indexing."""
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

    content_hash = hashlib.sha256(content_bytes).hexdigest()[:16]
    doc_id = (
        content_hash
        if scope == DocScope.GLOBAL
        else f"{session_id[:8] or 'session'}-{content_hash}"
    )
    source_path = _persist_source_file(doc_id, ext, content_bytes)

    tracked = await vector_store.register_document(
        doc_id=doc_id,
        filename=file.filename,
        total_chars=len(content_bytes),
        scope=scope.value,
        session_id=session_id if scope == DocScope.SESSION else "",
        source_ext=ext,
        source_path=source_path,
    )

    status = "registered"
    if scope == DocScope.GLOBAL:
        vector_store.start_global_ingestion_sequence(doc_id, active_tier)
        status = "processing"

    logger.info(
        "Registered '%s' (scope=%s, active_tier=%s).",
        file.filename,
        scope.value,
        active_tier.value,
    )

    return _build_upload_response(tracked, status=status)


@router.get("/list", response_model=DocsListResponse)
async def list_docs(
    session_id: Annotated[str, Query()] = "",
) -> DocsListResponse:
    """List visible tracked documents with per-tier state."""
    documents = [
        _build_doc_list_item(tracked)
        for tracked in await vector_store.list_tracked_documents(session_id)
    ]
    return DocsListResponse(documents=documents, store_stats=vector_store.get_stats())


@router.post("/load-sample")
async def load_sample() -> DocUploadResponse:
    """Load the built-in sample corpus (RAG reference guide) for Starter tier."""
    from app.utils.sample_corpus import get_sample_corpus_bytes

    content_bytes = get_sample_corpus_bytes()
    doc_id = "sample_rag_guide"
    source_path = _persist_source_file(doc_id, ".md", content_bytes)
    tracked = await vector_store.register_document(
        doc_id=doc_id,
        filename="RAG Guide (Built-in Sample)",
        total_chars=len(content_bytes),
        scope="global",
        source_ext=".md",
        source_path=source_path,
    )
    vector_store.start_global_ingestion_sequence(doc_id, Tier.STARTER)
    return _build_upload_response(tracked, status="processing")


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str) -> dict:
    """Remove a document from the index across all tiers."""
    tracked = await vector_store.get_tracked_document(doc_id)
    if tracked is None:
        raise HTTPException(status_code=404, detail="Document not found")

    source_path = tracked.source_path
    deleted = await vector_store.delete_tracked_document(doc_id)
    if deleted is None:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        Path(source_path).unlink(missing_ok=True)
    except Exception:
        logger.warning("Failed to delete source file '%s'", source_path)

    return {
        "doc_id": doc_id,
        "status": "deleted",
        "store_stats": vector_store.get_stats(),
    }


def _build_doc_list_item(tracked) -> DocListItem:
    return DocListItem(
        doc_id=tracked.doc_id,
        filename=tracked.filename,
        scope=tracked.scope,
        session_id=tracked.session_id,
        current_visibility="visible",
        tier_states={
            tier: DocTierStateInfo(
                status=tracked.tier_states.get(tier, "queued"),
                chunks=tracked.chunks_by_tier.get(tier, 0),
                error=tracked.error_by_tier.get(tier),
            )
            for tier in Tier
        },
        source_status=tracked.source_status,
    )


def _build_upload_response(tracked, *, status: str) -> DocUploadResponse:
    tier_states = {
        tier: DocTierStateInfo(
            status=tracked.tier_states.get(tier, "queued"),
            chunks=tracked.chunks_by_tier.get(tier, 0),
            error=tracked.error_by_tier.get(tier),
        )
        for tier in Tier
    }
    indexed_tiers = [
        tier.value
        for tier, state in tracked.tier_states.items()
        if state == "ready"
    ]
    return DocUploadResponse(
        doc_id=tracked.doc_id,
        filename=tracked.filename,
        chunks=tracked.chunks_by_tier.get(Tier.STARTER, 0),
        scope=tracked.scope,
        session_id=tracked.session_id,
        status=status,
        indexed_tiers=indexed_tiers,
        tier_states=tier_states,
        store_stats=vector_store.get_stats(),
    )
