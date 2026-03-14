"""RAG Arena 2026 — FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.redis_client import close_redis
from app.routes import chat, compare, config, docs, runs, settings as settings_route, stream
from app.db.database import AsyncSessionLocal, init_db
from app.services.reranking.local_llamacpp import probe_health
from app.services.retrieval_v2.store import store as vector_store
from app.services.runtime_models import bootstrap_runtime_models, get_enabled_chat_models
from app.services.runtime_settings import bootstrap_runtime_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle.

    Performs non-fatal startup probes so the app can degrade gracefully when
    optional local infrastructure is unavailable.
    """
    import asyncio

    async def _probe_reranker() -> None:
        loop = asyncio.get_event_loop()
        try:
            logger.info(
                "Probing local reranker enabled=%s model=%s base_url=%s",
                settings.reranker_enabled,
                settings.reranker_model,
                settings.reranker_base_url,
            )
            healthy = await loop.run_in_executor(None, probe_health)
            if healthy:
                logger.info("Local reranker is healthy at startup.")
            else:
                logger.warning("Local reranker is unavailable at startup; fused ranking fallback remains active.")
        except Exception as e:
            logger.warning(f"Failed to probe local reranker: {e}")

    asyncio.create_task(_probe_reranker())

    # Initialize SQLite tables
    try:
        await init_db()
        async with AsyncSessionLocal() as session:
            await bootstrap_runtime_settings(session)
            await bootstrap_runtime_models(session)
        await vector_store.recover_persisted_documents()
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
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Token"],
)

# --- Routes ---
app.include_router(chat.router)
app.include_router(compare.router)
app.include_router(config.router)
app.include_router(stream.router)
app.include_router(runs.router)
app.include_router(docs.router)
app.include_router(settings_route.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "rag-arena-backend"}


@app.get("/models")
async def list_models() -> dict:
    """Return available models and the default."""
    async with AsyncSessionLocal() as session:
        models, default = await get_enabled_chat_models(session)
    return {"models": models, "default": default}
