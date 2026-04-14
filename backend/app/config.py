"""RAG Arena 2026 — Backend Configuration."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

BOOTSTRAP_CHAT_MODELS = (
    "openrouter/openai/gpt-oss-20b",
    "openrouter/openai/gpt-oss-120b",
)
BOOTSTRAP_DEFAULT_CHAT_MODEL = "openrouter/openai/gpt-oss-20b"
BOOTSTRAP_EMBEDDING_MODEL = "openrouter/qwen/qwen3-embedding-8b"
BOOTSTRAP_RERANKER_MODEL = "ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF"
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

    # --- Code-owned retrieval models ---
    embedding_model: str = BOOTSTRAP_EMBEDDING_MODEL
    reranker_model: str = BOOTSTRAP_RERANKER_MODEL
    reranker_enabled: bool = True
    reranker_base_url: str = "http://127.0.0.1:8081"
    reranker_timeout_seconds: float = 5.0
    reranker_health_path: str = "/health"
    reranker_api_path: str = "/v1/rerank"
    reranker_model_cache_dir: str = "/app/cache/reranker"
    reranker_model_filename: str = "qwen3-reranker-0.6b-q8_0.gguf"
    reranker_server_host: str = "127.0.0.1"
    reranker_server_port: int = 8081

    # --- Code-owned LangExtract model ---
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
