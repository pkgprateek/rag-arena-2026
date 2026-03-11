"""RAG Arena 2026 — Pydantic data models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class Tier(str, Enum):
    """RAG tier taxonomy used across ingestion, retrieval, and UI copy.

    STARTER:    credible baseline for multi-doc RAG with citations
    PLUS:       biggest visible answer-quality jump for most buyers
    ENTERPRISE: production-grade retrieval reasoning and predictability
    MODERN:     enterprise core plus document-native, adaptive retrieval
    """

    STARTER = "starter"
    PLUS = "plus"
    ENTERPRISE = "enterprise"
    MODERN = "modern"


class DocScope(str, Enum):
    """Document scope controls which sessions can retrieve a document."""

    GLOBAL = "global"  # Available to all chat sessions
    SESSION = "session"  # Only available within the uploading session


class DocTierState(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"
    DELETED = "deleted"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RETRIEVING = "retrieving"
    GENERATING = "generating"
    EVALUATING = "evaluating"
    DONE = "done"
    ERROR = "error"


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# ---------------------------------------------------------------------------
# Core models
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    doc_id: str = ""
    page: int = 0
    section: str = ""
    snippet: str = ""
    score: float = 0.0


class Trace(BaseModel):
    retrieval_docs: list[str] = Field(default_factory=list)
    parse_mode: str = ""
    chunk_mode: str = ""
    rerank_deltas: list[float] = Field(default_factory=list)
    retrieval_mode: str = ""
    grounding_mode: str = ""
    optimization_mode: str = ""
    hybrid_used: bool = False
    rerank_used: bool = False
    query_orchestration_used: bool = False
    diversity_control_used: bool = False
    cache_hit: bool = False
    enrichment_used: bool = False
    page_aware_used: bool = False
    unique_docs_used: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    timings: dict[str, float] = Field(default_factory=dict)


class EvalResult(BaseModel):
    groundedness: float = 0.0
    relevance: float = 0.0
    citation_coverage: float = 0.0
    retrieval_precision: float = 0.0


class Run(BaseModel):
    id: str = Field(default_factory=_uuid)
    tier: Tier = Tier.STARTER
    status: RunStatus = RunStatus.QUEUED
    answer: str = ""
    citations: list[Citation] = Field(default_factory=list)
    trace: Trace = Field(default_factory=Trace)
    eval_result: Optional[EvalResult] = None
    latency_ms: float = 0.0
    cost_estimate: float = 0.0
    cache_hit: bool = False
    created_at: datetime = Field(default_factory=_utcnow)


class TierProfile(BaseModel):
    id: Tier
    market_position: str
    parse_mode: str
    chunk_mode: str
    retrieval_mode: str
    grounding_mode: str
    optimization_mode: str
    ui_summary: str


class TierRuntimeProfile(TierProfile):
    eval_trust_mode: str
    generation_temperature: float = 0.3
    generation_max_tokens: int = 1024
    use_hybrid: bool = False
    use_rerank: bool = False
    use_query_orchestration: bool = False
    use_diversity_control: bool = False
    use_semantic_cache: bool = False
    use_enrichment: bool = False
    use_page_aware: bool = False
    use_adaptive_retrieval: bool = False
    strict_grounding: bool = False
    dense_top_k: int = 5
    sparse_top_k: int = 0
    candidate_pool_k: int = 5
    final_top_k: int = 5
    per_doc_limit: int = 5
    system_prompt: str = ""


class Message(BaseModel):
    id: str = Field(default_factory=_uuid)
    role: Role = Role.USER
    content: str = ""
    tier: Optional[Tier] = None
    citations: list[Citation] = Field(default_factory=list)
    run_id: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Session(BaseModel):
    id: str = Field(default_factory=_uuid)
    messages: list[Message] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class CompareRun(BaseModel):
    id: str = Field(default_factory=_uuid)
    message_text: str = ""
    tiers: list[Tier] = Field(default_factory=list)
    run_ids: list[str] = Field(default_factory=list)
    status: RunStatus = RunStatus.QUEUED
    created_at: datetime = Field(default_factory=_utcnow)


class ProviderPreferences(BaseModel):
    order: list[str] = Field(default_factory=list)
    allow_fallbacks: bool = True
    require_parameters: bool = True
    zdr: bool | None = None
    only: list[str] = Field(default_factory=list)
    ignore: list[str] = Field(default_factory=list)
    sort: str | None = None
    max_price: dict[str, int] | None = None


class RuntimeModelConfig(BaseModel):
    id: str
    model_slug: str
    display_name: str
    is_enabled: bool = True
    is_default: bool = False
    supports_chat: bool = True
    supports_eval: bool = True
    supports_langextract: bool = False
    supports_embeddings: bool = False
    provider_preferences: ProviderPreferences = Field(
        default_factory=ProviderPreferences
    )
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    @property
    def public_model_name(self) -> str:
        return self.model_slug


class CreateRuntimeModelRequest(BaseModel):
    model_slug: str = Field(min_length=1)
    display_name: str = Field(min_length=1, max_length=120)
    is_enabled: bool = True
    is_default: bool = False
    supports_chat: bool = True
    supports_eval: bool = True
    supports_langextract: bool = False
    supports_embeddings: bool = False
    provider_preferences: ProviderPreferences = Field(
        default_factory=ProviderPreferences
    )


class UpdateRuntimeModelRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_enabled: bool | None = None
    is_default: bool | None = None
    supports_chat: bool | None = None
    supports_eval: bool | None = None
    supports_langextract: bool | None = None
    supports_embeddings: bool | None = None
    provider_preferences: ProviderPreferences | None = None


class RuntimeModelsResponse(BaseModel):
    models: list[RuntimeModelConfig] = Field(default_factory=list)


class RuntimeAppSettings(BaseModel):
    default_chat_model_slug: str
    embedding_model_slug: str
    reranker_model_slug: str
    langextract_model_slug: str
    semantic_cache_enabled: bool
    semantic_cache_ttl: int = Field(ge=0)
    semantic_cache_threshold: float = Field(ge=0.0, le=1.0)
    calcom_link: str


class UpdateRuntimeAppSettingsRequest(BaseModel):
    default_chat_model_slug: str | None = None
    embedding_model_slug: str | None = None
    reranker_model_slug: str | None = None
    langextract_model_slug: str | None = None
    semantic_cache_enabled: bool | None = None
    semantic_cache_ttl: int | None = Field(default=None, ge=0)
    semantic_cache_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    calcom_link: str | None = None

    @field_validator(
        "default_chat_model_slug",
        "embedding_model_slug",
        "reranker_model_slug",
        "langextract_model_slug",
    )
    @classmethod
    def strip_non_empty_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value cannot be empty")
        return stripped

    @field_validator("calcom_link")
    @classmethod
    def strip_optional_string(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


# ---------------------------------------------------------------------------
# API request / response shapes
# ---------------------------------------------------------------------------


class ChatSendRequest(BaseModel):
    session_id: str
    message: str
    tier: Tier = Tier.STARTER
    model: str = ""  # provider/model-name, uses default if empty


class ChatSendResponse(BaseModel):
    message_id: str
    run_id: str
    stream_url: str


class CompareRunRequest(BaseModel):
    session_id: str
    message_text: str
    tiers: list[Tier] = Field(default_factory=lambda: [Tier.STARTER, Tier.PLUS])
    model: str = ""  # provider/model-name, uses default if empty


class CompareRunResponse(BaseModel):
    compare_run_id: str
    stream_url: str


class StreamEvent(BaseModel):
    """Shape of each SSE data payload."""

    event: str  # status | token | metrics | citations | eval_result | done | error
    run_id: str = ""
    tier: Optional[Tier] = None
    data: dict | str | list = ""


class DocTierStateInfo(BaseModel):
    status: DocTierState
    chunks: int = 0
    error: str | None = None


class DocListItem(BaseModel):
    doc_id: str
    filename: str
    scope: DocScope
    session_id: str = ""
    current_visibility: Literal["visible", "hidden"] = "visible"
    tier_states: dict[Tier, DocTierStateInfo] = Field(default_factory=dict)
    source_status: Literal["persisted", "deleted"] = "persisted"


class DocsListResponse(BaseModel):
    documents: list[DocListItem] = Field(default_factory=list)
    store_stats: dict[str, Any] = Field(default_factory=dict)


class DocUploadResponse(BaseModel):
    doc_id: str
    filename: str
    chunks: int = 0
    scope: DocScope
    session_id: str = ""
    status: str
    indexed_tiers: list[str] = Field(default_factory=list)
    tier_states: dict[Tier, DocTierStateInfo] = Field(default_factory=dict)
    store_stats: dict[str, Any] = Field(default_factory=dict)
