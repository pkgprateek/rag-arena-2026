"""Shared OpenRouter request helpers."""

from __future__ import annotations

from typing import Any

from app.config import settings
from app.models import ProviderPreferences

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def normalize_model_spec(model_spec: str) -> str:
    """Normalize public model values into raw OpenRouter model slugs."""
    model = model_spec.strip()
    if not model:
        return ""
    if model.startswith("openrouter/"):
        model = model[len("openrouter/") :]
    return model


def public_model_name(model_slug: str) -> str:
    return normalize_model_spec(model_slug)


def openrouter_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }


def build_provider_preferences(
    preferences: ProviderPreferences | None,
) -> dict[str, Any] | None:
    if preferences is None:
        return None

    payload: dict[str, Any] = {}
    if preferences.order:
        payload["order"] = preferences.order
    payload["allow_fallbacks"] = preferences.allow_fallbacks
    payload["require_parameters"] = preferences.require_parameters
    if preferences.zdr is not None:
        payload["zdr"] = preferences.zdr
    if preferences.only:
        payload["only"] = preferences.only
    if preferences.ignore:
        payload["ignore"] = preferences.ignore
    if preferences.sort:
        payload["sort"] = preferences.sort
    if preferences.max_price:
        payload["max_price"] = preferences.max_price

    return payload or None


def build_chat_payload(
    *,
    model_slug: str,
    messages: list[dict[str, Any]],
    provider_preferences: ProviderPreferences | None = None,
    stream: bool = False,
    temperature: float = 0.0,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": normalize_model_spec(model_slug),
        "messages": messages,
        "stream": stream,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    provider = build_provider_preferences(provider_preferences)
    if provider:
        payload["provider"] = provider
    return payload


def build_embedding_payload(
    *,
    model_slug: str,
    texts: list[str],
    provider_preferences: ProviderPreferences | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": normalize_model_spec(model_slug),
        "input": texts,
    }
    provider = build_provider_preferences(provider_preferences)
    if provider:
        payload["provider"] = provider
    return payload
