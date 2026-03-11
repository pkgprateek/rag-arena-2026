"""RAG Arena 2026 — Backend Configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

BOOTSTRAP_CHAT_MODELS = (
    "openrouter/openai/gpt-oss-20b",
    "openrouter/openai/gpt-oss-120b",
)
BOOTSTRAP_DEFAULT_CHAT_MODEL = "openrouter/openai/gpt-oss-20b"
BOOTSTRAP_EMBEDDING_MODEL = "openrouter/openai/text-embedding-3-small"
BOOTSTRAP_RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
BOOTSTRAP_LANGEXTRACT_MODEL = "openrouter/openai/gpt-oss-20b"
BOOTSTRAP_SEMANTIC_CACHE_ENABLED = True
BOOTSTRAP_SEMANTIC_CACHE_TTL = 3600
BOOTSTRAP_SEMANTIC_CACHE_THRESHOLD = 0.92
BOOTSTRAP_CALCOM_LINK = "https://cal.com/your-username"


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
    openrouter_api_key: str = ""
    admin_settings_token: str = ""
    environment: str = "development"

    # --- Runtime-controlled model state ---
    # These values are mutated from runtime settings after boot.
    default_model: str = BOOTSTRAP_DEFAULT_CHAT_MODEL

    # --- Redis & Services ---
    redis_url: str = "redis://localhost:6379/0"
    chroma_url: str = "http://localhost:8000"
    database_url: str = "sqlite+aiosqlite:////app/data/rag_arena.db"
    uploads_dir: str = "/app/data/uploads"

    # --- Runtime-controlled retrieval models ---
    embedding_model: str = BOOTSTRAP_EMBEDDING_MODEL
    reranker_model: str = BOOTSTRAP_RERANKER_MODEL
    unstructured_api_key: str = ""

    # --- Runtime-controlled LangExtract model ---
    langextract_model: str = BOOTSTRAP_LANGEXTRACT_MODEL

    # --- Semantic Cache (Tier 4) ---
    semantic_cache_enabled: bool = BOOTSTRAP_SEMANTIC_CACHE_ENABLED
    semantic_cache_ttl: int = BOOTSTRAP_SEMANTIC_CACHE_TTL  # seconds, 0 = disabled
    semantic_cache_threshold: float = BOOTSTRAP_SEMANTIC_CACHE_THRESHOLD

    # --- Server ---
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:5173"

    # --- Runtime-controlled optional settings ---
    calcom_link: str = BOOTSTRAP_CALCOM_LINK

settings = Settings()
