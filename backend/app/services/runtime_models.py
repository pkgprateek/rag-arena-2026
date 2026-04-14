"""Runtime model registry backed by SQLite."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import (
    BOOTSTRAP_CHAT_MODELS,
    BOOTSTRAP_DEFAULT_CHAT_MODEL,
    BOOTSTRAP_EMBEDDING_MODEL,
    BOOTSTRAP_LANGEXTRACT_MODEL,
    settings,
)
from app.db.models import DBRuntimeModel, DBRuntimeModelRouting, DBRuntimeSetting
from app.models import (
    CreateRuntimeModelRequest,
    ProviderPreferences,
    RuntimeModelConfig,
    RuntimeModelsResponse,
    UpdateRuntimeModelRequest,
)
from app.services.openrouter import normalize_model_spec, public_model_name

logger = logging.getLogger(__name__)

_DISALLOWED_MODEL_PREFIXES = (
    "groq/",
    "google-ai-studio/",
    "vertex-ai/",
    "google-generative-ai/",
)


def _model_query():
    return select(DBRuntimeModel).options(selectinload(DBRuntimeModel.routing))


@dataclass
class ModelSelection:
    public_name: str
    runtime_model: RuntimeModelConfig


def _display_name_from_slug(model_slug: str) -> str:
    tail = model_slug.split("/")[-1]
    return tail.replace("-", " ").title()


def _serialize_json(values: list[str] | None) -> str | None:
    if values is None:
        return None
    return json.dumps(values)


def _routing_from_db(row: DBRuntimeModelRouting | None) -> ProviderPreferences:
    if row is None:
        return ProviderPreferences()
    max_price = None
    if row.max_price_prompt is not None or row.max_price_completion is not None:
        max_price = {}
        if row.max_price_prompt is not None:
            max_price["prompt"] = row.max_price_prompt
        if row.max_price_completion is not None:
            max_price["completion"] = row.max_price_completion
    return ProviderPreferences(
        order=json.loads(row.provider_order_json or "[]"),
        allow_fallbacks=row.allow_fallbacks,
        require_parameters=row.require_parameters,
        zdr=row.zdr,
        only=json.loads(row.only_providers_json or "[]"),
        ignore=json.loads(row.ignore_providers_json or "[]"),
        sort=row.sort,
        max_price=max_price,
    )


def _runtime_model_from_db(row: DBRuntimeModel) -> RuntimeModelConfig:
    return RuntimeModelConfig(
        id=row.id,
        model_slug=row.model_slug,
        display_name=row.display_name,
        is_enabled=row.is_enabled,
        is_default=row.is_default,
        supports_chat=row.supports_chat,
        supports_eval=row.supports_eval,
        supports_langextract=row.supports_langextract,
        supports_embeddings=row.supports_embeddings,
        provider_preferences=_routing_from_db(row.routing),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _validate_provider_preferences(preferences: ProviderPreferences) -> None:
    if not preferences.allow_fallbacks and not preferences.order:
        raise HTTPException(
            status_code=400,
            detail="provider_preferences.order is required when allow_fallbacks is false",
        )


def _validate_supported_model_slug(model_slug: str) -> None:
    lowered = model_slug.lower()
    if lowered.startswith(_DISALLOWED_MODEL_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only OpenRouter-backed raw model slugs are supported. "
                f"Received '{model_slug}'."
            ),
        )


def _normalize_supported_model_slug(model_slug: str) -> str:
    slug = normalize_model_spec(model_slug)
    if not slug:
        raise HTTPException(status_code=400, detail="model_slug cannot be empty")
    _validate_supported_model_slug(slug)
    return slug


def _sorted_enabled_chat_rows(rows: list[DBRuntimeModel]) -> list[DBRuntimeModel]:
    return sorted(
        [row for row in rows if row.is_enabled and row.supports_chat],
        key=lambda row: row.model_slug,
    )


def _seed_candidates() -> list[CreateRuntimeModelRequest]:
    models: list[str] = list(BOOTSTRAP_CHAT_MODELS)
    models.append(BOOTSTRAP_LANGEXTRACT_MODEL)
    models.append(BOOTSTRAP_EMBEDDING_MODEL)

    normalized: dict[str, CreateRuntimeModelRequest] = {}
    default_slug = normalize_model_spec(BOOTSTRAP_DEFAULT_CHAT_MODEL)
    langextract_slug = normalize_model_spec(BOOTSTRAP_LANGEXTRACT_MODEL)
    embedding_slug = normalize_model_spec(BOOTSTRAP_EMBEDDING_MODEL)

    special_routing: dict[str, ProviderPreferences] = {
        "openai/gpt-oss-20b": ProviderPreferences(sort="price"),
        "openai/gpt-oss-120b": ProviderPreferences(
            only=["atlas-cloud/fp8", "google-vertex"]
        ),
        "qwen/qwen3-embedding-8b": ProviderPreferences(
            allow_fallbacks=True,
            require_parameters=True,
            sort="price",
        ),
    }

    for raw in models:
        slug = normalize_model_spec(raw)
        if not slug:
            continue
        if slug.lower().startswith(_DISALLOWED_MODEL_PREFIXES):
            logger.warning("Skipping unsupported legacy model seed '%s'", raw)
            continue
        current = normalized.get(slug)
        if current is None:
            current = CreateRuntimeModelRequest(
                model_slug=slug,
                display_name=_display_name_from_slug(slug),
                is_enabled=True,
                is_default=slug == default_slug,
                supports_chat=slug != embedding_slug,
                supports_eval=slug != embedding_slug,
                supports_langextract=slug == langextract_slug,
                supports_embeddings=slug == embedding_slug,
                provider_preferences=special_routing.get(slug, ProviderPreferences()),
            )
            normalized[slug] = current
            continue

        current.is_default = current.is_default or slug == default_slug
        current.supports_chat = current.supports_chat or slug != embedding_slug
        current.supports_eval = current.supports_eval or slug != embedding_slug
        current.supports_langextract = (
            current.supports_langextract or slug == langextract_slug
        )
        current.supports_embeddings = (
            current.supports_embeddings or slug == embedding_slug
        )

    candidates = list(normalized.values())
    if candidates and not any(candidate.is_default for candidate in candidates):
        for candidate in candidates:
            if candidate.supports_chat:
                candidate.is_default = True
                break
    return candidates


async def bootstrap_runtime_models(session: AsyncSession) -> None:
    seeds = _seed_candidates()
    if not seeds:
        logger.warning("Runtime model registry bootstrap skipped: no OpenRouter seed models configured.")
        return

    result = await session.execute(_model_query())
    existing_rows = {row.model_slug: row for row in result.scalars().all()}
    created = 0

    for seed in seeds:
        row = existing_rows.get(seed.model_slug)
        if row is None:
            row = DBRuntimeModel(
                id=uuid.uuid4().hex,
                model_slug=seed.model_slug,
                display_name=seed.display_name,
                is_enabled=seed.is_enabled,
                is_default=False,
                supports_chat=seed.supports_chat,
                supports_eval=seed.supports_eval,
                supports_langextract=seed.supports_langextract,
                supports_embeddings=seed.supports_embeddings,
            )
            session.add(row)
            created += 1
        else:
            row.display_name = seed.display_name
            row.is_enabled = row.is_enabled or seed.is_enabled
            row.supports_chat = row.supports_chat or seed.supports_chat
            row.supports_eval = row.supports_eval or seed.supports_eval
            row.supports_langextract = (
                row.supports_langextract or seed.supports_langextract
            )
            row.supports_embeddings = (
                row.supports_embeddings or seed.supports_embeddings
            )

        if row.routing is None:
            row.routing = DBRuntimeModelRouting(
                provider_order_json="[]",
                allow_fallbacks=True,
                require_parameters=True,
            )
        row.routing.provider_order_json = json.dumps(seed.provider_preferences.order)
        row.routing.allow_fallbacks = seed.provider_preferences.allow_fallbacks
        row.routing.require_parameters = seed.provider_preferences.require_parameters
        row.routing.zdr = seed.provider_preferences.zdr
        row.routing.only_providers_json = _serialize_json(seed.provider_preferences.only)
        row.routing.ignore_providers_json = _serialize_json(
            seed.provider_preferences.ignore
        )
        row.routing.sort = seed.provider_preferences.sort
        row.routing.max_price_prompt = (
            seed.provider_preferences.max_price or {}
        ).get("prompt")
        row.routing.max_price_completion = (
            seed.provider_preferences.max_price or {}
        ).get("completion")

    await session.flush()
    preferred_default = normalize_model_spec(BOOTSTRAP_DEFAULT_CHAT_MODEL) or "openai/gpt-oss-20b"
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    for row in rows:
        row.is_default = row.model_slug == preferred_default and row.is_enabled and row.supports_chat
    await _ensure_default_chat_model(session)
    await _sync_default_chat_setting(session)
    await session.commit()
    logger.info(
        "Bootstrapped runtime model registry. created=%s total_seeded=%s",
        created,
        len(seeds),
    )


async def list_runtime_models(session: AsyncSession) -> RuntimeModelsResponse:
    result = await session.execute(
        _model_query().order_by(
            DBRuntimeModel.is_default.desc(), DBRuntimeModel.model_slug.asc()
        )
    )
    return RuntimeModelsResponse(
        models=[_runtime_model_from_db(row) for row in result.scalars().all()]
    )


async def get_runtime_model_by_id(
    session: AsyncSession, model_id: str
) -> RuntimeModelConfig | None:
    result = await session.execute(_model_query().where(DBRuntimeModel.id == model_id))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return _runtime_model_from_db(row)


async def resolve_chat_model(
    session: AsyncSession, requested_model: str = ""
) -> ModelSelection:
    normalized_request = normalize_model_spec(requested_model)
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    configs = [
        _runtime_model_from_db(row)
        for row in rows
        if row.is_enabled and row.supports_chat
    ]
    if not configs:
        raise HTTPException(
            status_code=400,
            detail="No enabled chat models are configured in runtime settings.",
        )

    if normalized_request:
        for config in configs:
            if config.model_slug == normalized_request:
                return ModelSelection(public_model_name(config.model_slug), config)
        raise HTTPException(
            status_code=400,
            detail=f"Model '{requested_model}' is not enabled for chat.",
        )

    for config in configs:
        if config.is_default:
            return ModelSelection(public_model_name(config.model_slug), config)
    return ModelSelection(public_model_name(configs[0].model_slug), configs[0])


async def get_enabled_chat_models(session: AsyncSession) -> tuple[list[str], str]:
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    enabled_chat = _sorted_enabled_chat_rows(rows)
    default_slug = await get_default_chat_model_slug(session)
    models = [public_model_name(row.model_slug) for row in enabled_chat]
    if default_slug and default_slug in models:
        models = [default_slug, *[model for model in models if model != default_slug]]
    return models, default_slug


async def get_default_chat_model_slug(session: AsyncSession) -> str:
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    enabled_chat = _sorted_enabled_chat_rows(rows)
    if not enabled_chat:
        return ""
    for row in enabled_chat:
        if row.is_default:
            return public_model_name(row.model_slug)
    return public_model_name(enabled_chat[0].model_slug)


async def set_default_chat_model_slug(
    session: AsyncSession, model_slug: str
) -> str:
    normalized = _normalize_supported_model_slug(model_slug)
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    target = None
    for row in rows:
        row.is_default = False
        if row.model_slug == normalized:
            target = row
    if target is None or not target.is_enabled or not target.supports_chat:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{model_slug}' is not enabled for chat.",
        )
    target.is_default = True
    await _sync_default_chat_setting(session)
    return public_model_name(target.model_slug)


async def get_model_for_capability(
    session: AsyncSession, capability: str
) -> RuntimeModelConfig | None:
    result = await session.execute(_model_query())
    rows = [
        _runtime_model_from_db(row) for row in result.scalars().all() if row.is_enabled
    ]
    attr_name = {
        "chat": "supports_chat",
        "eval": "supports_eval",
        "langextract": "supports_langextract",
        "embeddings": "supports_embeddings",
    }[capability]
    candidates = [row for row in rows if getattr(row, attr_name)]
    if not candidates:
        return None
    for candidate in candidates:
        if candidate.is_default:
            return candidate
    return candidates[0]


async def create_runtime_model(
    session: AsyncSession, request: CreateRuntimeModelRequest
) -> RuntimeModelConfig:
    _validate_provider_preferences(request.provider_preferences)
    slug = _normalize_supported_model_slug(request.model_slug)

    existing = await session.execute(
        _model_query().where(DBRuntimeModel.model_slug == slug)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Model '{slug}' already exists")

    if request.is_default:
        if not request.is_enabled or not request.supports_chat:
            raise HTTPException(
                status_code=400,
                detail="Default model must be enabled and support chat.",
            )
        await _clear_default_flags(session)

    row = DBRuntimeModel(
        id=uuid.uuid4().hex,
        model_slug=slug,
        display_name=request.display_name.strip(),
        is_enabled=request.is_enabled,
        is_default=request.is_default,
        supports_chat=request.supports_chat,
        supports_eval=request.supports_eval,
        supports_langextract=request.supports_langextract,
        supports_embeddings=request.supports_embeddings,
    )
    row.routing = DBRuntimeModelRouting(
        provider_order_json=json.dumps(request.provider_preferences.order),
        allow_fallbacks=request.provider_preferences.allow_fallbacks,
        require_parameters=request.provider_preferences.require_parameters,
        zdr=request.provider_preferences.zdr,
        only_providers_json=_serialize_json(request.provider_preferences.only),
        ignore_providers_json=_serialize_json(request.provider_preferences.ignore),
        sort=request.provider_preferences.sort,
        max_price_prompt=(request.provider_preferences.max_price or {}).get("prompt"),
        max_price_completion=(request.provider_preferences.max_price or {}).get(
            "completion"
        ),
    )
    session.add(row)
    await _ensure_default_chat_model(session)
    await _sync_default_chat_setting(session)
    await session.commit()
    model = await get_runtime_model_by_id(session, row.id)
    if model is None:
        raise HTTPException(status_code=500, detail="Created model could not be reloaded")
    return model


async def update_runtime_model(
    session: AsyncSession, model_id: str, request: UpdateRuntimeModelRequest
) -> RuntimeModelConfig:
    result = await session.execute(_model_query().where(DBRuntimeModel.id == model_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")

    if request.provider_preferences is not None:
        _validate_provider_preferences(request.provider_preferences)

    if request.is_default:
        await _clear_default_flags(session, exclude_id=model_id)
        row.is_default = True
    elif request.is_default is False:
        row.is_default = False

    for field_name in (
        "display_name",
        "is_enabled",
        "supports_chat",
        "supports_eval",
        "supports_langextract",
        "supports_embeddings",
    ):
        value = getattr(request, field_name)
        if value is not None:
            setattr(row, field_name, value.strip() if field_name == "display_name" else value)

    if row.is_default and (not row.is_enabled or not row.supports_chat):
        row.is_default = False

    if row.routing is None:
        row.routing = DBRuntimeModelRouting(
            provider_order_json="[]",
            allow_fallbacks=True,
            require_parameters=True,
        )

    if request.provider_preferences is not None:
        row.routing.provider_order_json = json.dumps(request.provider_preferences.order)
        row.routing.allow_fallbacks = request.provider_preferences.allow_fallbacks
        row.routing.require_parameters = request.provider_preferences.require_parameters
        row.routing.zdr = request.provider_preferences.zdr
        row.routing.only_providers_json = _serialize_json(
            request.provider_preferences.only
        )
        row.routing.ignore_providers_json = _serialize_json(
            request.provider_preferences.ignore
        )
        row.routing.sort = request.provider_preferences.sort
        row.routing.max_price_prompt = (
            request.provider_preferences.max_price or {}
        ).get("prompt")
        row.routing.max_price_completion = (
            request.provider_preferences.max_price or {}
        ).get("completion")

    await _ensure_default_chat_model(session)
    await _sync_default_chat_setting(session)
    await session.commit()
    model = await get_runtime_model_by_id(session, row.id)
    if model is None:
        raise HTTPException(status_code=500, detail="Updated model could not be reloaded")
    return model


async def disable_runtime_model(session: AsyncSession, model_id: str) -> RuntimeModelConfig:
    result = await session.execute(_model_query().where(DBRuntimeModel.id == model_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    row.is_enabled = False
    row.is_default = False
    await _ensure_default_chat_model(session)
    await _sync_default_chat_setting(session)
    await session.commit()
    model = await get_runtime_model_by_id(session, row.id)
    if model is None:
        raise HTTPException(status_code=500, detail="Updated model could not be reloaded")
    return model


async def make_runtime_model_default(
    session: AsyncSession, model_id: str
) -> RuntimeModelConfig:
    result = await session.execute(_model_query().where(DBRuntimeModel.id == model_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    if not row.is_enabled or not row.supports_chat:
        raise HTTPException(
            status_code=400,
            detail="Default model must be enabled and support chat.",
        )
    await _clear_default_flags(session, exclude_id=model_id)
    row.is_default = True
    await _sync_default_chat_setting(session)
    await session.commit()
    model = await get_runtime_model_by_id(session, row.id)
    if model is None:
        raise HTTPException(status_code=500, detail="Updated model could not be reloaded")
    return model


async def _clear_default_flags(
    session: AsyncSession, exclude_id: str | None = None
) -> None:
    result = await session.execute(_model_query())
    for row in result.scalars().all():
        if exclude_id and row.id == exclude_id:
            continue
        row.is_default = False


async def _ensure_default_chat_model(session: AsyncSession) -> None:
    result = await session.execute(_model_query())
    rows = result.scalars().all()
    enabled_chat = _sorted_enabled_chat_rows(rows)
    if not enabled_chat:
        return
    if any(row.is_default for row in enabled_chat):
        return
    enabled_chat[0].is_default = True


async def _sync_default_chat_setting(session: AsyncSession) -> None:
    default_slug = await get_default_chat_model_slug(session)
    settings.default_model = default_slug
    row = await session.get(DBRuntimeSetting, "default_chat_model_slug")
    if row is None:
        session.add(DBRuntimeSetting(key="default_chat_model_slug", value=default_slug))
    else:
        row.value = default_slug
