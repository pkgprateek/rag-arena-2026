"""Runtime app settings backed by SQLite."""

from __future__ import annotations

import logging

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
from app.db.models import DBRuntimeSetting
from app.models import RuntimeAppSettings, UpdateRuntimeAppSettingsRequest
from app.services.openrouter import normalize_model_spec
from app.services.runtime_models import (
    get_default_chat_model_slug,
    set_default_chat_model_slug,
)

logger = logging.getLogger(__name__)

_SETTING_KEYS = (
    "default_chat_model_slug",
    "semantic_cache_enabled",
    "semantic_cache_ttl",
    "semantic_cache_threshold",
    "calcom_link",
)
_CODE_OWNED_MODEL_KEYS = (
    "embedding_model_slug",
    "reranker_model_slug",
    "langextract_model_slug",
)
_LEGACY_MODEL_KEYS = (
    "embedding_model",
    "reranker_model",
    "langextract_model",
)
_DEPRECATED_UPDATE_FIELDS = {
    "embedding_model_slug",
    "reranker_model_slug",
    "langextract_model_slug",
}


def _as_bool(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalized_settings_payload() -> dict[str, str]:
    return {
        "default_chat_model_slug": normalize_model_spec(BOOTSTRAP_DEFAULT_CHAT_MODEL),
        "semantic_cache_enabled": "true" if BOOTSTRAP_SEMANTIC_CACHE_ENABLED else "false",
        "semantic_cache_ttl": str(BOOTSTRAP_SEMANTIC_CACHE_TTL),
        "semantic_cache_threshold": str(BOOTSTRAP_SEMANTIC_CACHE_THRESHOLD),
        "calcom_link": BOOTSTRAP_CALCOM_LINK,
    }


def _apply_code_owned_model_settings() -> None:
    settings.embedding_model = BOOTSTRAP_EMBEDDING_MODEL
    settings.reranker_model = BOOTSTRAP_RERANKER_MODEL
    settings.langextract_model = BOOTSTRAP_LANGEXTRACT_MODEL


def _apply_runtime_setting(key: str, value: str) -> None:
    if key == "default_chat_model_slug":
        settings.default_model = normalize_model_spec(value)
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


async def _cleanup_deprecated_runtime_settings(session: AsyncSession) -> list[str]:
    deprecated_keys = {*_CODE_OWNED_MODEL_KEYS, *_LEGACY_MODEL_KEYS}
    result = await session.execute(
        select(DBRuntimeSetting).where(DBRuntimeSetting.key.in_(deprecated_keys))
    )
    rows = result.scalars().all()
    removed_keys: list[str] = []
    for row in rows:
        removed_keys.append(row.key)
        await session.delete(row)
    if removed_keys:
        logger.info(
            "runtime_settings_cleanup removed_keys=%s",
            ",".join(sorted(removed_keys)),
        )
    return removed_keys


def _validate_update_request(request: UpdateRuntimeAppSettingsRequest) -> None:
    extras = set((request.model_extra or {}).keys())
    if not extras:
        return

    deprecated = sorted(extras & _DEPRECATED_UPDATE_FIELDS)
    if deprecated:
        raise HTTPException(
            status_code=400,
            detail=(
                "These settings are platform-managed and cannot be updated: "
                + ", ".join(deprecated)
            ),
        )

    raise HTTPException(
        status_code=400,
        detail=f"Unknown settings fields: {', '.join(sorted(extras))}",
    )


async def sync_runtime_app_settings(session: AsyncSession) -> None:
    default_slug = await get_default_chat_model_slug(session)
    if default_slug:
        await _upsert_setting(session, "default_chat_model_slug", default_slug)
        _apply_runtime_setting("default_chat_model_slug", default_slug)


async def bootstrap_runtime_settings(session: AsyncSession) -> None:
    _apply_code_owned_model_settings()
    await _cleanup_deprecated_runtime_settings(session)
    for key, value in _normalized_settings_payload().items():
        row = await session.get(DBRuntimeSetting, key)
        if row is None:
            session.add(DBRuntimeSetting(key=key, value=value))
            _apply_runtime_setting(key, value)
            continue
        _apply_runtime_setting(key, row.value)
    _apply_code_owned_model_settings()
    await session.commit()


async def get_runtime_app_settings(session: AsyncSession) -> RuntimeAppSettings:
    _apply_code_owned_model_settings()
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
        semantic_cache_enabled=_as_bool(values["semantic_cache_enabled"]),
        semantic_cache_ttl=int(values["semantic_cache_ttl"]),
        semantic_cache_threshold=float(values["semantic_cache_threshold"]),
        calcom_link=values["calcom_link"],
        embedding_model=settings.embedding_model,
        reranker_model=settings.reranker_model,
        langextract_model=settings.langextract_model,
        reranker_backend="local_llamacpp",
    )


async def update_runtime_app_settings(
    session: AsyncSession, request: UpdateRuntimeAppSettingsRequest
) -> RuntimeAppSettings:
    _validate_update_request(request)
    _apply_code_owned_model_settings()
    if request.default_chat_model_slug is not None:
        default_slug = await set_default_chat_model_slug(
            session, request.default_chat_model_slug
        )
        await _upsert_setting(session, "default_chat_model_slug", default_slug)
        _apply_runtime_setting("default_chat_model_slug", default_slug)

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

    _apply_code_owned_model_settings()
    await session.commit()
    return await get_runtime_app_settings(session)
