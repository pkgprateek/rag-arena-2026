"""Runtime app settings backed by SQLite with DB-authoritative runtime state."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    BOOTSTRAP_CALCOM_LINK,
    BOOTSTRAP_DEFAULT_CHAT_MODEL,
    BOOTSTRAP_EMBEDDING_MODEL,
    BOOTSTRAP_LANGEXTRACT_MODEL,
    BOOTSTRAP_RERANKER_MODEL,
    BOOTSTRAP_SEMANTIC_CACHE_ENABLED,
    BOOTSTRAP_SEMANTIC_CACHE_THRESHOLD,
    BOOTSTRAP_SEMANTIC_CACHE_TTL,
    settings,
)
from app.db.models import DBRuntimeModel, DBRuntimeSetting
from app.models import RuntimeAppSettings, UpdateRuntimeAppSettingsRequest
from app.services.openrouter import normalize_model_spec
from app.services.runtime_models import (
    get_default_chat_model_slug,
    set_default_chat_model_slug,
)

_SETTING_KEYS = (
    "default_chat_model_slug",
    "embedding_model_slug",
    "reranker_model_slug",
    "langextract_model_slug",
    "semantic_cache_enabled",
    "semantic_cache_ttl",
    "semantic_cache_threshold",
    "calcom_link",
)


def _as_bool(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalized_settings_payload() -> dict[str, str]:
    return {
        "default_chat_model_slug": normalize_model_spec(BOOTSTRAP_DEFAULT_CHAT_MODEL),
        "embedding_model_slug": normalize_model_spec(BOOTSTRAP_EMBEDDING_MODEL),
        "reranker_model_slug": BOOTSTRAP_RERANKER_MODEL,
        "langextract_model_slug": normalize_model_spec(BOOTSTRAP_LANGEXTRACT_MODEL),
        "semantic_cache_enabled": "true" if BOOTSTRAP_SEMANTIC_CACHE_ENABLED else "false",
        "semantic_cache_ttl": str(BOOTSTRAP_SEMANTIC_CACHE_TTL),
        "semantic_cache_threshold": str(BOOTSTRAP_SEMANTIC_CACHE_THRESHOLD),
        "calcom_link": BOOTSTRAP_CALCOM_LINK,
    }


def _apply_runtime_setting(key: str, value: str) -> None:
    if key == "default_chat_model_slug":
        settings.default_model = normalize_model_spec(value)
    elif key == "embedding_model_slug":
        settings.embedding_model = normalize_model_spec(value)
    elif key == "reranker_model_slug":
        settings.reranker_model = value
    elif key == "langextract_model_slug":
        settings.langextract_model = normalize_model_spec(value)
    elif key == "semantic_cache_enabled":
        settings.semantic_cache_enabled = _as_bool(value)
    elif key == "semantic_cache_ttl":
        settings.semantic_cache_ttl = int(value)
    elif key == "semantic_cache_threshold":
        settings.semantic_cache_threshold = float(value)
    elif key == "calcom_link":
        settings.calcom_link = value


async def _upsert_setting(session: AsyncSession, key: str, value: str) -> None:
    row = await session.get(DBRuntimeSetting, key)
    if row is None:
        session.add(DBRuntimeSetting(key=key, value=value))
    else:
        row.value = value


async def sync_runtime_app_settings(session: AsyncSession) -> None:
    default_slug = await get_default_chat_model_slug(session)
    if default_slug:
        await _upsert_setting(session, "default_chat_model_slug", default_slug)
        _apply_runtime_setting("default_chat_model_slug", default_slug)


async def bootstrap_runtime_settings(session: AsyncSession) -> None:
    for key, value in _normalized_settings_payload().items():
        row = await session.get(DBRuntimeSetting, key)
        if row is None:
            session.add(DBRuntimeSetting(key=key, value=value))
            _apply_runtime_setting(key, value)
            continue
        _apply_runtime_setting(key, row.value)
    await session.commit()


async def _require_enabled_model_for_capability(
    session: AsyncSession, model_slug: str, capability: str
) -> str:
    normalized_slug = normalize_model_spec(model_slug)
    if not normalized_slug:
        raise HTTPException(status_code=400, detail=f"{capability} model slug cannot be empty.")

    capability_column = {
        "embedding": DBRuntimeModel.supports_embeddings,
        "langextract": DBRuntimeModel.supports_langextract,
    }[capability]

    result = await session.execute(
        select(DBRuntimeModel).where(
            DBRuntimeModel.model_slug == normalized_slug,
            DBRuntimeModel.is_enabled.is_(True),
            capability_column.is_(True),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Model '{normalized_slug}' is not enabled for {capability} usage."
            ),
        )
    return normalized_slug


async def get_runtime_app_settings(session: AsyncSession) -> RuntimeAppSettings:
    values = _normalized_settings_payload()
    for key in _SETTING_KEYS:
        row = await session.get(DBRuntimeSetting, key)
        if row is not None:
            values[key] = row.value
            _apply_runtime_setting(key, row.value)

    default_slug = await get_default_chat_model_slug(session)
    if default_slug and values["default_chat_model_slug"] != default_slug:
        values["default_chat_model_slug"] = default_slug
        await _upsert_setting(session, "default_chat_model_slug", default_slug)
        _apply_runtime_setting("default_chat_model_slug", default_slug)
        await session.commit()

    return RuntimeAppSettings(
        default_chat_model_slug=normalize_model_spec(values["default_chat_model_slug"]),
        embedding_model_slug=normalize_model_spec(values["embedding_model_slug"]),
        reranker_model_slug=values["reranker_model_slug"],
        langextract_model_slug=normalize_model_spec(values["langextract_model_slug"]),
        semantic_cache_enabled=_as_bool(values["semantic_cache_enabled"]),
        semantic_cache_ttl=int(values["semantic_cache_ttl"]),
        semantic_cache_threshold=float(values["semantic_cache_threshold"]),
        calcom_link=values["calcom_link"],
    )


async def update_runtime_app_settings(
    session: AsyncSession, request: UpdateRuntimeAppSettingsRequest
) -> RuntimeAppSettings:
    if request.default_chat_model_slug is not None:
        default_slug = await set_default_chat_model_slug(
            session, request.default_chat_model_slug
        )
        await _upsert_setting(session, "default_chat_model_slug", default_slug)
        _apply_runtime_setting("default_chat_model_slug", default_slug)

    if request.embedding_model_slug is not None:
        stored = await _require_enabled_model_for_capability(
            session, request.embedding_model_slug, "embedding"
        )
        await _upsert_setting(session, "embedding_model_slug", stored)
        _apply_runtime_setting("embedding_model_slug", stored)

    if request.langextract_model_slug is not None:
        stored = await _require_enabled_model_for_capability(
            session, request.langextract_model_slug, "langextract"
        )
        await _upsert_setting(session, "langextract_model_slug", stored)
        _apply_runtime_setting("langextract_model_slug", stored)

    if request.reranker_model_slug is not None:
        await _upsert_setting(session, "reranker_model_slug", request.reranker_model_slug)
        _apply_runtime_setting("reranker_model_slug", request.reranker_model_slug)

    if request.semantic_cache_enabled is not None:
        stored = "true" if request.semantic_cache_enabled else "false"
        await _upsert_setting(session, "semantic_cache_enabled", stored)
        _apply_runtime_setting("semantic_cache_enabled", stored)

    if request.semantic_cache_ttl is not None:
        stored = str(request.semantic_cache_ttl)
        await _upsert_setting(session, "semantic_cache_ttl", stored)
        _apply_runtime_setting("semantic_cache_ttl", stored)

    if request.semantic_cache_threshold is not None:
        stored = str(request.semantic_cache_threshold)
        await _upsert_setting(session, "semantic_cache_threshold", stored)
        _apply_runtime_setting("semantic_cache_threshold", stored)

    if request.calcom_link is not None:
        await _upsert_setting(session, "calcom_link", request.calcom_link)
        _apply_runtime_setting("calcom_link", request.calcom_link)

    await session.commit()
    return await get_runtime_app_settings(session)
