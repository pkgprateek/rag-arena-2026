"""SQLAlchemy models for persistence."""

import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class DBSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(
        DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc)
    )

    messages = relationship(
        "DBMessage",
        back_populates="session",
        order_by="DBMessage.created_at",
        cascade="all, delete-orphan",
    )


class DBMessage(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), index=True)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    tier = Column(String, nullable=True)
    model = Column(String, nullable=True)
    run_id = Column(String, nullable=True)  # ID of the generation run
    citations_json = Column(Text, nullable=True)  # JSON serialized list of citations
    created_at = Column(
        DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc)
    )

    session = relationship("DBSession", back_populates="messages")


class DBRuntimeModel(Base):
    __tablename__ = "llm_models"

    id = Column(String, primary_key=True, index=True)
    model_slug = Column(String, nullable=False, unique=True, index=True)
    display_name = Column(String, nullable=False)
    is_enabled = Column(Boolean, nullable=False, default=True)
    is_default = Column(Boolean, nullable=False, default=False)
    supports_chat = Column(Boolean, nullable=False, default=True)
    supports_eval = Column(Boolean, nullable=False, default=True)
    supports_langextract = Column(Boolean, nullable=False, default=False)
    supports_embeddings = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc),
    )

    routing = relationship(
        "DBRuntimeModelRouting",
        back_populates="model",
        uselist=False,
        cascade="all, delete-orphan",
    )


class DBRuntimeModelRouting(Base):
    __tablename__ = "llm_model_routing"

    model_id = Column(String, ForeignKey("llm_models.id"), primary_key=True)
    provider_order_json = Column(Text, nullable=False, default="[]")
    allow_fallbacks = Column(Boolean, nullable=False, default=True)
    require_parameters = Column(Boolean, nullable=False, default=True)
    zdr = Column(Boolean, nullable=True)
    only_providers_json = Column(Text, nullable=True)
    ignore_providers_json = Column(Text, nullable=True)
    sort = Column(String, nullable=True)
    max_price_prompt = Column(Integer, nullable=True)
    max_price_completion = Column(Integer, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc),
    )

    model = relationship("DBRuntimeModel", back_populates="routing")


class DBRuntimeSetting(Base):
    __tablename__ = "runtime_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc),
    )


class DBDocument(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    scope = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=True, index=True)
    filename = Column(String, nullable=False)
    source_ext = Column(String, nullable=False, default="")
    source_path = Column(String, nullable=False)
    total_chars = Column(Integer, nullable=False, default=0)
    content_hash = Column(String, nullable=False, index=True)
    source_status = Column(String, nullable=False, default="persisted")
    created_at = Column(
        DateTime(timezone=True), default=datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc),
    )

    tier_states = relationship(
        "DBDocumentTierState",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DBDocumentTierState(Base):
    __tablename__ = "document_tier_states"

    document_id = Column(String, ForeignKey("documents.id"), primary_key=True)
    tier = Column(String, primary_key=True)
    status = Column(String, nullable=False, default="queued")
    chunks = Column(Integer, nullable=False, default=0)
    error_text = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.datetime.now(datetime.timezone.utc),
        onupdate=datetime.datetime.now(datetime.timezone.utc),
    )

    document = relationship("DBDocument", back_populates="tier_states")


Index("ix_documents_scope_session", DBDocument.scope, DBDocument.session_id)
