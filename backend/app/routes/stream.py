"""RAG Arena 2026 — SSE streaming endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sse_starlette.sse import EventSourceResponse

from app.services.streaming import event_generator

router = APIRouter(tags=["streaming"])


@router.get("/stream/{stream_id}")
async def stream(
    stream_id: str,
    tiers: int = Query(default=1, description="Number of tier runs to wait for"),
) -> EventSourceResponse:
    """Server-Sent Events endpoint.

    For single chat: GET /stream/{id} (default tiers=1).
    For compare:     GET /stream/{id}?tiers=2 (or however many tiers).
    """
    return EventSourceResponse(
        event_generator(stream_id, expected_done_count=tiers),
        media_type="text/event-stream",
    )
