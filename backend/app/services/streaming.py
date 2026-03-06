"""RAG Arena 2026 — SSE streaming helpers.

Publishes events to Redis pub/sub channels and exposes an async generator
for sse-starlette to consume.

Supports both single-run (chat) and multi-run (compare) modes.
"""

from __future__ import annotations

import json
from typing import AsyncGenerator

from app.models import StreamEvent
from app.redis_client import get_redis


def _channel(stream_id: str) -> str:
    return f"sse:{stream_id}"


async def publish_event(stream_id: str, event: StreamEvent) -> None:
    """Publish a single SSE event to the Redis channel for *stream_id*."""
    r = await get_redis()
    await r.publish(_channel(stream_id), event.model_dump_json())


async def event_generator(
    stream_id: str,
    *,
    expected_done_count: int = 1,
) -> AsyncGenerator[dict, None]:
    """Yield SSE-compatible dicts from Redis pub/sub.

    For single chat: expected_done_count=1 (default).
    For compare runs: expected_done_count=len(tiers).
    Closes only after ALL expected "done"/"error" events arrive.
    """
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(_channel(stream_id))

    done_count = 0

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            payload = json.loads(message["data"])
            event_type = payload.get("event", "unknown")

            yield {
                "event": event_type,
                "data": json.dumps(payload),
            }

            if event_type in ("done", "error"):
                done_count += 1
                if done_count >= expected_done_count:
                    break
    finally:
        await pubsub.unsubscribe(_channel(stream_id))
        await pubsub.aclose()
