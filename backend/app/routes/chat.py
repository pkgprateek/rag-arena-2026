"""RAG Arena 2026 — Chat route."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import (
    ChatSendRequest,
    ChatSendResponse,
    Message as ApiMessage,
    Role,
    Run,
)
from app.redis_client import get_redis
from app.services.pipeline import run_pipeline
from app.db.database import get_db
from app.db.models import DBSession, DBMessage
from app.services.runtime_models import resolve_chat_model
from app.services.retrieval_v2.store import store as vector_store

router = APIRouter(prefix="/chat", tags=["chat"])

# Max message length to prevent token explosion / cost spikes
MAX_MESSAGE_LENGTH = 10_000


@router.get("/sessions")
async def get_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DBSession).order_by(DBSession.created_at.desc()))
    sessions = result.scalars().all()

    payload = []
    for s in sessions:
        tier_result = await db.execute(
            select(DBMessage.tier)
            .where(DBMessage.session_id == s.id)
            .where(DBMessage.role == Role.USER.value)
            .where(DBMessage.tier.is_not(None))
            .order_by(DBMessage.created_at.asc())
            .limit(1)
        )
        session_tier = tier_result.scalar_one_or_none()
        payload.append(
            {
                "id": s.id,
                "created_at": s.created_at,
                "tier": session_tier or "starter",
            }
        )

    return payload


@router.get("/sessions/{session_id}")
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DBMessage)
        .where(DBMessage.session_id == session_id)
        .order_by(DBMessage.created_at.asc())
    )
    msgs = result.scalars().all()
    res = []
    for m in msgs:
        res.append(
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "tier": m.tier,
                "model": m.model,
                "run_id": m.run_id,
                "citations": json.loads(m.citations_json) if m.citations_json else [],
            }
        )
    session_tier = "starter"
    for m in msgs:
        if m.role == Role.USER.value and m.tier:
            session_tier = m.tier
            break

    return {"messages": res, "session_tier": session_tier}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    db_session = await db.get(DBSession, session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    deleted_docs = await vector_store.delete_session_documents(session_id)
    for tracked in deleted_docs:
        try:
            from pathlib import Path

            Path(tracked.source_path).unlink(missing_ok=True)
        except Exception:
            pass

    await db.execute(delete(DBMessage).where(DBMessage.session_id == session_id))
    await db.execute(delete(DBSession).where(DBSession.id == session_id))
    await db.commit()

    return {"session_id": session_id, "status": "deleted"}


@router.post("/send", response_model=ChatSendResponse)
async def chat_send(
    req: ChatSendRequest, db: AsyncSession = Depends(get_db)
) -> ChatSendResponse:
    """Accept a user message, kick off the pipeline, return stream URL."""

    # --- Input validation ---
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(req.message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long ({len(req.message)} chars). Max: {MAX_MESSAGE_LENGTH}",
        )

    # Resolve and validate model
    selection = await resolve_chat_model(db, req.model)
    model = selection.public_name

    # Ensure session exists in DB
    db_session = await db.get(DBSession, req.session_id)
    if not db_session:
        db_session = DBSession(id=req.session_id)
        db.add(db_session)

    # Define user message
    user_msg = ApiMessage(role=Role.USER, content=req.message, tier=req.tier)

    # Store user message in DB
    db_msg = DBMessage(
        id=user_msg.id,
        session_id=req.session_id,
        role=user_msg.role,
        content=user_msg.content,
        tier=req.tier.value if req.tier else None,
        model=model,
    )
    db.add(db_msg)
    await db.commit()

    run = Run(tier=req.tier)
    stream_id = run.id

    r = await get_redis()
    await r.set(f"run:{run.id}", run.model_dump_json(), ex=3600)

    # Store session message reference (1h TTL) for redis
    await r.rpush(f"session:{req.session_id}:messages", user_msg.model_dump_json())
    await r.expire(f"session:{req.session_id}:messages", 3600)

    asyncio.create_task(
        run_pipeline(
            run_id=run.id,
            stream_id=stream_id,
            tier=req.tier,
            model=model,
            user_message=req.message,
            session_id=req.session_id,
        )
    )

    return ChatSendResponse(
        message_id=user_msg.id,
        run_id=run.id,
        stream_url=f"/api/stream/{stream_id}",
    )
