"""Runtime settings routes for model management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models import (
    CreateRuntimeModelRequest,
    RuntimeAppSettings,
    RuntimeModelConfig,
    RuntimeModelsResponse,
    UpdateRuntimeAppSettingsRequest,
    UpdateRuntimeModelRequest,
)
from app.services.runtime_models import (
    create_runtime_model,
    disable_runtime_model,
    list_runtime_models,
    make_runtime_model_default,
    update_runtime_model,
)
from app.services.runtime_settings import (
    get_runtime_app_settings,
    update_runtime_app_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminTokenHeader = Annotated[str | None, Header(alias="X-Admin-Token")]


def _require_admin_token(admin_token: AdminTokenHeader) -> None:
    configured = settings.admin_settings_token.strip()
    if not configured:
        if settings.environment.lower() == "development":
            return
        raise HTTPException(
            status_code=503,
            detail="Settings access is disabled until ADMIN_SETTINGS_TOKEN is configured.",
        )
    if admin_token != configured:
        raise HTTPException(status_code=401, detail="Invalid admin token")


@router.get("/models", response_model=RuntimeModelsResponse)
async def get_models(
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeModelsResponse:
    _require_admin_token(admin_token)
    return await list_runtime_models(db)


@router.get("/app", response_model=RuntimeAppSettings)
async def get_app_settings(
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeAppSettings:
    _require_admin_token(admin_token)
    return await get_runtime_app_settings(db)


@router.patch("/app", response_model=RuntimeAppSettings)
async def update_app_settings(
    request: UpdateRuntimeAppSettingsRequest,
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeAppSettings:
    _require_admin_token(admin_token)
    return await update_runtime_app_settings(db, request)


@router.post("/models", response_model=RuntimeModelConfig)
async def create_model(
    request: CreateRuntimeModelRequest,
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeModelConfig:
    _require_admin_token(admin_token)
    return await create_runtime_model(db, request)


@router.patch("/models/{model_id}", response_model=RuntimeModelConfig)
async def update_model(
    model_id: str,
    request: UpdateRuntimeModelRequest,
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeModelConfig:
    _require_admin_token(admin_token)
    return await update_runtime_model(db, model_id, request)


@router.delete("/models/{model_id}", response_model=RuntimeModelConfig)
async def delete_model(
    model_id: str,
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeModelConfig:
    _require_admin_token(admin_token)
    return await disable_runtime_model(db, model_id)


@router.post("/models/{model_id}/make-default", response_model=RuntimeModelConfig)
async def set_default_model(
    model_id: str,
    db: DbDep,
    admin_token: AdminTokenHeader = None,
) -> RuntimeModelConfig:
    _require_admin_token(admin_token)
    return await make_runtime_model_default(db, model_id)
