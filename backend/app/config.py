"""RAG Arena 2026 — Backend Configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings, loaded from environment / .env."""

    model_config = SettingsConfigDict(
        # Try multiple locations so both local dev and Docker work.
        # Docker: env vars are injected by docker-compose env_file directive.
        # Local dev: .env in project root, or ../.env if running from backend/
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM providers ---
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    google_ai_studio_api_key: str = ""

    # --- Models ---
    # Comma-separated list of models. Format: provider/model-name
    # Example: groq/llama-3.3-70b-versatile,groq/llama-3.1-8b-instant
    available_models: str = ""
    default_model: str = ""

    # --- Redis & Services ---
    redis_url: str = "redis://localhost:6379/0"
    chroma_url: str = "http://localhost:8000"
    database_url: str = "sqlite+aiosqlite:////app/data/rag_arena.db"
    uploads_dir: str = "/app/data/uploads"

    # --- Embedding & Reranking Models ---
    # Fast remote API embeddings via Google AI Studio
    embedding_model: str = "text-embedding-004"
    reranker_model: str = "BAAI/bge-reranker-v2-m3"

    # Unstructured Serverless API key (https://platform.unstructuredapp.io)
    # Tiers 2+ will fall back to basic parsing if this is not set.
    unstructured_api_key: str = ""

    # --- LangExtract (Modern-tier metadata enrichment) ---
    langextract_model: str = "google/gemini-2.0-flash"

    # --- Semantic Cache (Tier 4) ---
    semantic_cache_ttl: int = 3600  # seconds, 0 = disabled
    semantic_cache_threshold: float = 0.92  # cosine similarity threshold

    # --- Server ---
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"

    # --- Optional ---
    calcom_link: str = "https://cal.com/your-username"

    def get_available_models(self) -> list[str]:
        """Return list of configured models, deduped."""
        if not self.available_models:
            return []

        seen: set[str] = set()
        result: list[str] = []
        for m in self.available_models.split(","):
            m = m.strip()
            if m and m not in seen:
                seen.add(m)
                result.append(m)
        return result

    def get_default_model(self) -> str:
        """Return the default model (first in AVAILABLE_MODELS if not set)."""
        if self.default_model:
            return self.default_model
        models = self.get_available_models()
        return models[0] if models else ""


settings = Settings()
