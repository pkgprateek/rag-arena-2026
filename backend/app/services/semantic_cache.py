"""RAG Arena 2026 — Semantic Cache.

Tier 4 (Modern): Caches query→answer pairs and returns cached answers for
semantically similar queries, skipping the LLM call entirely.

Flow:
  1. Embed incoming query
  2. Check Redis for cached (embedding, answer, citations) with cosine sim > threshold
  3. Cache hit  → return cached answer + citations, set cache_hit=True
  4. Cache miss → proceed to LLM, then cache the result

Uses sentence-transformers (same model as ChromaDB) for embeddings.
Uses Redis for storage with configurable TTL.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.config import settings
from app.services.embeddings import get_embedder

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    import math

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# Redis key prefix for cached queries
_CACHE_PREFIX = "semcache:"


async def cache_lookup(
    query: str,
    tier: str,
) -> dict[str, Any] | None:
    """Check if a semantically similar query has been answered before.

    Returns the cached entry dict on hit, None on miss.
    """
    if not settings.semantic_cache_enabled or settings.semantic_cache_ttl <= 0:
        return None  # Cache disabled

    embedder = get_embedder()

    try:
        from app.redis_client import get_redis

        r = await get_redis()

        # Embed the incoming query (returns a list of embeddings)
        query_embeddings = await embedder.encode([query])
        query_embedding = query_embeddings[0]

        # Scan cached entries for this tier
        pattern = f"{_CACHE_PREFIX}{tier}:*"
        cached_keys = []
        async for key in r.scan_iter(match=pattern, count=100):
            cached_keys.append(key)

        if not cached_keys:
            return None

        # Check similarity against each cached entry
        best_match: dict[str, Any] | None = None
        best_sim = 0.0

        for key in cached_keys:
            raw = await r.get(key)
            if not raw:
                continue

            entry = json.loads(raw)
            cached_embedding = entry.get("embedding", [])
            if not cached_embedding:
                continue

            sim = _cosine_similarity(query_embedding, cached_embedding)
            if sim > best_sim:
                best_sim = sim
                best_match = entry

        threshold = settings.semantic_cache_threshold
        if best_match and best_sim >= threshold:
            logger.info(
                f"Semantic cache HIT (similarity={best_sim:.3f}, threshold={threshold})"
            )
            best_match["similarity"] = round(best_sim, 3)
            return best_match

        return None

    except Exception as e:
        logger.warning(f"Semantic cache lookup failed: {e}")
        return None


async def cache_store(
    query: str,
    tier: str,
    answer: str,
    citations: list[dict],
    eval_result: dict | None = None,
    cost_estimate: float = 0.0,
) -> None:
    """Store a query→answer pair in the semantic cache."""
    if not settings.semantic_cache_enabled or settings.semantic_cache_ttl <= 0:
        return  # Cache disabled

    embedder = get_embedder()

    try:
        from app.redis_client import get_redis

        r = await get_redis()

        query_embeddings = await embedder.encode([query])
        query_embedding = query_embeddings[0]

        # Use a hash of the query as key (deterministic for same exact query)
        import hashlib

        query_hash = hashlib.md5(query.encode()).hexdigest()[:16]
        key = f"{_CACHE_PREFIX}{tier}:{query_hash}"

        entry = {
            "query": query,
            "answer": answer,
            "citations": citations,
            "eval_result": eval_result,
            "cost_estimate": cost_estimate,
            "embedding": query_embedding,
            "cached_at": time.time(),
        }

        await r.set(key, json.dumps(entry), ex=settings.semantic_cache_ttl)
        logger.info(f"Semantic cache STORE: {key}")

    except Exception as e:
        logger.warning(f"Semantic cache store failed: {e}")
