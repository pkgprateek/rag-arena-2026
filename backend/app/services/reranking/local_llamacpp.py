"""Local llama.cpp reranker client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.ingestion.chunkers import Chunk

logger = logging.getLogger(__name__)


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _health_url() -> str:
    return _join_url(settings.reranker_base_url, settings.reranker_health_path)


def _rerank_url() -> str:
    return _join_url(settings.reranker_base_url, settings.reranker_api_path)


def _build_payload(query: str, chunks: list[Chunk]) -> dict[str, Any]:
    return {
        "model": settings.reranker_model,
        "query": query,
        "documents": [chunk.content for chunk in chunks],
    }


def _parse_scores(payload: dict[str, Any], expected_count: int) -> list[tuple[int, float]] | None:
    results = payload.get("results")
    if not isinstance(results, list) or len(results) != expected_count:
        return None

    parsed: list[tuple[int, float]] = []
    for fallback_index, item in enumerate(results):
        if not isinstance(item, dict):
            return None

        index = item.get("index", fallback_index)
        score = item.get("relevance_score", item.get("score"))
        if not isinstance(index, int) or not isinstance(score, (int, float)):
            return None
        if index < 0 or index >= expected_count:
            return None
        parsed.append((index, float(score)))

    if len({index for index, _score in parsed}) != expected_count:
        return None

    return parsed


def is_available() -> bool:
    if not settings.reranker_enabled:
        return False
    return probe_health()


def probe_health() -> bool:
    if not settings.reranker_enabled:
        return False

    try:
        with httpx.Client(timeout=settings.reranker_timeout_seconds) as client:
            response = client.get(_health_url())
            response.raise_for_status()
        return True
    except httpx.HTTPError as exc:
        logger.warning(
            "Local reranker health probe failed url=%s timeout=%.2fs error=%s",
            _health_url(),
            settings.reranker_timeout_seconds,
            exc.__class__.__name__,
        )
        return False


def rerank(query: str, chunks: list[Chunk], top_k: int) -> list[tuple[Chunk, float]] | None:
    if not settings.reranker_enabled or not chunks:
        return None

    try:
        with httpx.Client(timeout=settings.reranker_timeout_seconds) as client:
            response = client.post(_rerank_url(), json=_build_payload(query, chunks))
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning(
            "Local reranker request failed url=%s model=%s timeout=%.2fs error=%s",
            _rerank_url(),
            settings.reranker_model,
            settings.reranker_timeout_seconds,
            exc.__class__.__name__,
        )
        return None

    try:
        payload = response.json()
    except ValueError:
        logger.warning(
            "Local reranker returned invalid JSON url=%s model=%s",
            _rerank_url(),
            settings.reranker_model,
        )
        return None

    parsed = _parse_scores(payload, expected_count=len(chunks))
    if parsed is None:
        logger.warning(
            "Local reranker returned malformed payload url=%s model=%s",
            _rerank_url(),
            settings.reranker_model,
        )
        return None

    scored_chunks = [(chunks[index], score) for index, score in parsed]
    scored_chunks.sort(key=lambda item: item[1], reverse=True)
    return scored_chunks[:top_k]
