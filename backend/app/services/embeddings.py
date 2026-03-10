"""RAG Arena 2026 — Fast API-based Embeddings.

Replaces local sentence-transformers with remote API calls (Google/OpenRouter)
to prevent blocking the main FastAPI thread and improve overall system speed.
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class APIEmbedder:
    def __init__(self, model_name: str = ""):
        self.model_name = model_name or settings.embedding_model

    async def encode(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        provider = "google"
        if "/" in self.model_name or "openai" in self.model_name.lower():
            provider = "openrouter"

        api_key = (
            settings.google_ai_studio_api_key
            if provider == "google"
            else settings.openrouter_api_key
        )
        base_url = (
            "https://generativelanguage.googleapis.com/v1beta/openai"
            if provider == "google"
            else "https://openrouter.ai/api/v1"
        )

        if not api_key:
            logger.error(f"No API key configured for {provider} embeddings!")
            return [[0.0] * 768 for _ in texts]

        logger.debug(f"Calling embedding API for {len(texts)} chunks via {provider}")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{base_url}/embeddings",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"model": self.model_name, "input": texts},
                )
                res.raise_for_status()
                data = res.json()

                # Sort by index to maintain order just in case
                items = data.get("data", [])
                items.sort(key=lambda x: x.get("index", 0))

                return [item.get("embedding", []) for item in items]
        except Exception as e:
            logger.error(f"Embedding API failed ({provider}): {e}")
            if hasattr(e, "response") and e.response:
                logger.error(f"Response: {e.response.text}")
            return [[0.0] * 768 for _ in texts]


_INSTANCE = None


def get_embedder() -> APIEmbedder:
    """Get the singleton API embedder instance."""
    global _INSTANCE
    if _INSTANCE is None:
        _INSTANCE = APIEmbedder()
    return _INSTANCE
