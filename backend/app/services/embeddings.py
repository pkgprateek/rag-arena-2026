"""OpenRouter-backed embeddings client."""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.db.database import AsyncSessionLocal
from app.models import ProviderPreferences
from app.services.openrouter import (
    OPENROUTER_BASE_URL,
    build_embedding_payload,
    normalize_model_spec,
    openrouter_headers,
)
from app.services.runtime_models import get_model_for_capability

logger = logging.getLogger(__name__)


class APIEmbedder:
    def __init__(self, model_name: str = ""):
        self.model_name = model_name or settings.embedding_model

    async def _resolve_model_config(self) -> tuple[str, ProviderPreferences | None]:
        async with AsyncSessionLocal() as session:
            runtime_model = await get_model_for_capability(session, "embeddings")
        if runtime_model is not None:
            return runtime_model.model_slug, runtime_model.provider_preferences
        return normalize_model_spec(self.model_name), None

    async def encode(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        if not settings.openrouter_api_key:
            logger.error("No OpenRouter API key configured for embeddings.")
            return [[0.0] * 768 for _ in texts]

        model_name, provider_preferences = await self._resolve_model_config()
        logger.debug("Calling OpenRouter embedding API for %s chunks", len(texts))
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{OPENROUTER_BASE_URL}/embeddings",
                    headers=openrouter_headers(),
                    json=build_embedding_payload(
                        model_slug=model_name,
                        texts=texts,
                        provider_preferences=provider_preferences,
                    ),
                )
                res.raise_for_status()
                data = res.json()
                items = data.get("data", [])
                items.sort(key=lambda item: item.get("index", 0))
                return [item.get("embedding", []) for item in items]
        except Exception as exc:
            logger.error("Embedding API failed via OpenRouter: %s", exc)
            if hasattr(exc, "response") and exc.response is not None:
                logger.error("Response: %s", exc.response.text)
            return [[0.0] * 768 for _ in texts]


_INSTANCE: APIEmbedder | None = None


def get_embedder() -> APIEmbedder:
    global _INSTANCE
    if _INSTANCE is None:
        _INSTANCE = APIEmbedder()
    return _INSTANCE
