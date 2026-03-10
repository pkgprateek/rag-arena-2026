"""RAG Arena 2026 — Pydantic data models."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


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
