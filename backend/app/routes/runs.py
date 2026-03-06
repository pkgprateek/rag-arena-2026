"""RAG Arena 2026 — Runs export route."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.redis_client import get_redis

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/{run_id}")
async def get_run(run_id: str) -> dict:
    """Return the full Run record (trace + eval) for export."""
    r = await get_redis()
    data = await r.get(f"run:{run_id}")
    if data is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return json.loads(data)
