"""RAG Arena 2026 — Redis client singleton."""

from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings

_pool: aioredis.ConnectionPool | None = None


async def get_redis() -> aioredis.Redis:
    """Return an async Redis client (lazy-creates connection pool)."""
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
    return aioredis.Redis(connection_pool=_pool)


async def close_redis() -> None:
    """Shutdown the connection pool gracefully."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
