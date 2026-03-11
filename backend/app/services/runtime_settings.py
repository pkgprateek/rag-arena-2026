"""Runtime app settings backed by SQLite with sync to model defaults."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import DBRuntimeSetting
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
        "default_chat_model_slug": normalize_model_spec(settings.default_model),
        "embedding_model_slug": normalize_model_spec(settings.embedding_model),
        "reranker_model_slug": settings.reranker_model,
        "langextract_model_slug": normalize_model_spec(settings.langextract_model),
        "semantic_cache_enabled": "true" if settings.semantic_cache_enabled else "false",
        "semantic_cache_ttl": str(settings.semantic_cache_ttl),
        "semantic_cache_threshold": str(settings.semantic_cache_threshold),
        "calcom_link": settings.calcom_link,
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
        else:
            _apply_runtime_setting(key, row.value)
    await session.commit()


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

    for field_name in (
        "embedding_model_slug",
        "reranker_model_slug",
        "langextract_model_slug",
        "semantic_cache_enabled",
        "semantic_cache_ttl",
        "semantic_cache_threshold",
        "calcom_link",
    ):
        value = getattr(request, field_name)
        if value is None:
            continue
        stored = str(value)
        if field_name in {"embedding_model_slug", "langextract_model_slug"}:
            stored = normalize_model_spec(stored)
        elif field_name == "semantic_cache_enabled":
            stored = "true" if value else "false"
        await _upsert_setting(session, field_name, stored)
        _apply_runtime_setting(field_name, stored)

    await session.commit()
    return await get_runtime_app_settings(session)
