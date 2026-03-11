import os
import tempfile
import unittest
import importlib.util
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.database import Base
from app.models import (
    CreateRuntimeModelRequest,
    ProviderPreferences,
    UpdateRuntimeAppSettingsRequest,
)
import app.main as app_main
from app.services.openrouter import build_provider_preferences, normalize_model_spec
from app.services.runtime_models import (
    bootstrap_runtime_models,
    create_runtime_model,
    disable_runtime_model,
    get_enabled_chat_models,
    resolve_chat_model,
)
from app.services.runtime_settings import (
    bootstrap_runtime_settings,
    get_runtime_app_settings,
    update_runtime_app_settings,
)


class RuntimeModelServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        if importlib.util.find_spec("greenlet") is None:
            self.skipTest("greenlet is not installed in this environment")
        self._settings_backup = {
            "available_models": settings.available_models,
            "default_model": settings.default_model,
            "langextract_model": settings.langextract_model,
            "embedding_model": settings.embedding_model,
            "reranker_model": settings.reranker_model,
            "semantic_cache_enabled": settings.semantic_cache_enabled,
            "semantic_cache_ttl": settings.semantic_cache_ttl,
            "semantic_cache_threshold": settings.semantic_cache_threshold,
            "calcom_link": settings.calcom_link,
        }
        settings.available_models = (
            "openrouter/google/gemini-2.5-flash,openrouter/anthropic/claude-3.7-sonnet"
        )
        settings.default_model = "openrouter/google/gemini-2.5-flash"
        settings.langextract_model = "openrouter/google/gemini-2.5-flash"
        settings.embedding_model = "openrouter/openai/text-embedding-3-small"
        settings.reranker_model = "BAAI/bge-reranker-v2-m3"
        settings.semantic_cache_enabled = True
        settings.semantic_cache_ttl = 3600
        settings.semantic_cache_threshold = 0.92
        settings.calcom_link = "https://cal.example.com/team/demo"

        handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        handle.close()
        self._db_path = handle.name
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self._db_path}")
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def asyncTearDown(self) -> None:
        for key, value in self._settings_backup.items():
            setattr(settings, key, value)
        await self.engine.dispose()
        if os.path.exists(self._db_path):
            os.unlink(self._db_path)

    async def test_bootstrap_runtime_models_and_default_selection(self) -> None:
        async with self.session_factory() as session:
            await bootstrap_runtime_models(session)
            models, default = await get_enabled_chat_models(session)
            selection = await resolve_chat_model(session, "")

        self.assertIn("google/gemini-2.5-flash", models)
        self.assertEqual(default, "google/gemini-2.5-flash")
        self.assertEqual(selection.runtime_model.model_slug, "google/gemini-2.5-flash")

    async def test_disable_default_promotes_next_chat_model(self) -> None:
        async with self.session_factory() as session:
            await bootstrap_runtime_models(session)
            original = await resolve_chat_model(session, "")
            second = await resolve_chat_model(
                session, "anthropic/claude-3.7-sonnet"
            )
            await disable_runtime_model(session, original.runtime_model.id)
            models, default = await get_enabled_chat_models(session)

        self.assertNotIn("google/gemini-2.5-flash", models)
        self.assertEqual(default, second.public_name)

    async def test_create_runtime_model_rejects_strict_provider_without_order(self) -> None:
        async with self.session_factory() as session:
            with self.assertRaises(HTTPException):
                await create_runtime_model(
                    session,
                    CreateRuntimeModelRequest(
                        model_slug="google/gemini-2.5-pro",
                        display_name="Gemini 2.5 Pro",
                        is_enabled=True,
                        is_default=False,
                        supports_chat=True,
                        supports_eval=True,
                        supports_langextract=False,
                        supports_embeddings=False,
                        provider_preferences=ProviderPreferences(
                            order=[],
                            allow_fallbacks=False,
                            require_parameters=True,
                        ),
                    ),
                )

    async def test_runtime_app_settings_sync_with_default_model(self) -> None:
        async with self.session_factory() as session:
            await bootstrap_runtime_settings(session)
            await bootstrap_runtime_models(session)

            initial = await get_runtime_app_settings(session)
            self.assertEqual(initial.default_chat_model_slug, "google/gemini-2.5-flash")
            self.assertEqual(
                initial.embedding_model_slug, "openai/text-embedding-3-small"
            )
            self.assertTrue(initial.semantic_cache_enabled)

            updated = await update_runtime_app_settings(
                session,
                UpdateRuntimeAppSettingsRequest(
                    default_chat_model_slug="anthropic/claude-3.7-sonnet",
                    semantic_cache_enabled=False,
                    semantic_cache_ttl=120,
                    semantic_cache_threshold=0.88,
                    calcom_link="https://cal.example.com/new-link",
                ),
            )
            models, default = await get_enabled_chat_models(session)

        self.assertIn("anthropic/claude-3.7-sonnet", models)
        self.assertEqual(default, "anthropic/claude-3.7-sonnet")
        self.assertEqual(updated.default_chat_model_slug, default)
        self.assertFalse(updated.semantic_cache_enabled)
        self.assertEqual(updated.semantic_cache_ttl, 120)
        self.assertEqual(updated.semantic_cache_threshold, 0.88)
        self.assertEqual(updated.calcom_link, "https://cal.example.com/new-link")

    async def test_models_handler_returns_expected_shape(self) -> None:
        async with self.session_factory() as session:
            await bootstrap_runtime_settings(session)
            await bootstrap_runtime_models(session)

        with patch.object(app_main, "AsyncSessionLocal", self.session_factory):
            payload = await app_main.list_models()

        self.assertEqual(
            payload,
            {
                "models": [
                    "google/gemini-2.5-flash",
                    "anthropic/claude-3.7-sonnet",
                ],
                "default": "google/gemini-2.5-flash",
            },
        )


class OpenRouterHelperTests(unittest.TestCase):
    def test_normalize_model_spec(self) -> None:
        self.assertEqual(
            normalize_model_spec("openrouter/google/gemini-2.5-flash"),
            "google/gemini-2.5-flash",
        )
        self.assertEqual(normalize_model_spec("google/gemini-2.5-flash"), "google/gemini-2.5-flash")

    def test_build_provider_preferences(self) -> None:
        payload = build_provider_preferences(
            ProviderPreferences(
                order=["google-ai-studio", "vertex-ai"],
                allow_fallbacks=False,
                require_parameters=True,
            )
        )
        self.assertEqual(payload["order"], ["google-ai-studio", "vertex-ai"])
        self.assertFalse(payload["allow_fallbacks"])
        self.assertTrue(payload["require_parameters"])


if __name__ == "__main__":
    unittest.main()
