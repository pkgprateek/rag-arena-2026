"""SQLAlchemy models for persisting Chat components."""

import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
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
