"""RAG Arena 2026 — FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.redis_client import close_redis
from app.routes import chat, compare, config, docs, runs, stream
from app.db.database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle.

    Pre-warms models in background threads so the first upload/chat doesn't
    block on a cold model load (which can take 5-30s on CPU).
    """
    import asyncio

    async def _prewarm() -> None:
        loop = asyncio.get_event_loop()
        # API-based embeddings do not require pre-warming lengths of PyTorch models

        # Pre-warm BGE reranker (Tier 3+)
        try:
            from app.services.retrieval_v2.search import _get_reranker

            await loop.run_in_executor(None, _get_reranker)
            logger.info("BGE reranker model pre-warmed.")
        except Exception as e:
            logger.warning(f"Failed to pre-warm reranker: {e}")

    asyncio.create_task(_prewarm())

    # Initialize SQLite tables
    try:
        await init_db()
        logger.info("SQLite database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize SQLite db: {e}")

    yield
    await close_redis()


app = FastAPI(
    title="RAG Arena 2026",
    description="Portfolio-grade RAG comparison API",
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS (tightened: only necessary methods) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# --- Routes ---
app.include_router(chat.router)
app.include_router(compare.router)
app.include_router(config.router)
app.include_router(stream.router)
app.include_router(runs.router)
app.include_router(docs.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "rag-arena-backend"}


@app.get("/models")
async def list_models() -> dict:
    """Return available models and the default."""
    models = settings.get_available_models()
    default = settings.get_default_model()
    return {"models": models, "default": default}
