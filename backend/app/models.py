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
    """RAG quality tier — controls ingestion pipeline and generation params.

    STARTER:    basic parsing + fixed chunking + dense retrieval (simple RAG)
    PLUS:       Unstructured parsing + semantic chunking + hybrid retrieval
    ENTERPRISE: deep hybrid retrieval + BGE reranking + semantic cache
    MODERN:     layout/page-aware chunks + LangExtract enrichment + boost-aware retrieval
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
    snippet: str = ""
    score: float = 0.0


class Trace(BaseModel):
    retrieval_docs: list[str] = Field(default_factory=list)
    rerank_deltas: list[float] = Field(default_factory=list)
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
