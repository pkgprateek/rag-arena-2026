"""RAG Arena 2026 — Compare route."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CompareRun,
    CompareRunRequest,
    CompareRunResponse,
    Run,
)
from app.db.database import get_db
from app.redis_client import get_redis
from app.services.pipeline import run_pipeline
from app.services.runtime_models import resolve_chat_model

router = APIRouter(prefix="/compare", tags=["compare"])

MAX_MESSAGE_LENGTH = 10_000
MAX_TIERS = 4


@router.post("/run", response_model=CompareRunResponse)
async def compare_run(
    req: CompareRunRequest,
    db: AsyncSession = Depends(get_db),
) -> CompareRunResponse:
    """Run the same question across multiple tiers in parallel."""

    # --- Input validation ---
    if not req.message_text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(req.message_text) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long ({len(req.message_text)} chars). Max: {MAX_MESSAGE_LENGTH}",
        )

    if len(req.tiers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Compare requires at least 2 tiers",
        )

    if len(req.tiers) > MAX_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Max {MAX_TIERS} tiers per compare run",
        )

    # Resolve and validate model
    selection = await resolve_chat_model(db, req.model)
    model = selection.public_name

    compare = CompareRun(
        message_text=req.message_text,
        tiers=req.tiers,
    )
    stream_id = compare.id

    runs: list[Run] = []
    for tier in req.tiers:
        run = Run(tier=tier)
        runs.append(run)
        compare.run_ids.append(run.id)

    r = await get_redis()
    await r.set(f"compare:{compare.id}", compare.model_dump_json(), ex=3600)

    for run in runs:
        asyncio.create_task(
            run_pipeline(
                run_id=run.id,
                stream_id=stream_id,
                tier=run.tier,
                model=model,
                user_message=req.message_text,
                session_id=req.session_id,
            )
        )

    tier_count = len(req.tiers)
    return CompareRunResponse(
        compare_run_id=compare.id,
        stream_url=f"/api/stream/{stream_id}?tiers={tier_count}",
    )
