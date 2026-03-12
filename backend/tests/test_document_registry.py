import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base
from app.db.models import DBDocumentTierState
from app.models import DocTierState, Tier
from app.services.retrieval_v2 import store as store_module
from app.services.retrieval_v2.store import MultiIndexStore


class DocumentRegistryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "docs.db"
        self.engine = create_async_engine(
            f"sqlite+aiosqlite:///{self.db_path}",
            connect_args={"check_same_thread": False},
        )
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self.original_session_local = store_module.AsyncSessionLocal
        store_module.AsyncSessionLocal = self.session_factory

        self.store = MultiIndexStore()
        self.store._collection = None

        handle = tempfile.NamedTemporaryFile(
            suffix=".txt",
            dir=self.temp_dir.name,
            delete=False,
        )
        handle.write(b"hello world")
        handle.close()
        self.source_path = Path(handle.name)

    async def asyncTearDown(self) -> None:
        store_module.AsyncSessionLocal = self.original_session_local
        await self.engine.dispose()
        self.source_path.unlink(missing_ok=True)
        self.temp_dir.cleanup()

    async def test_session_document_persists_and_recovers_after_restart(self) -> None:
        tracked = await self.store.register_document(
            doc_id="session-doc",
            filename="session.txt",
            total_chars=11,
            scope="session",
            session_id="session-1",
            source_ext=".txt",
            source_path=str(self.source_path),
        )

        self.assertEqual(tracked.tier_states[Tier.STARTER], DocTierState.QUEUED)

        visible_docs = await self.store.list_tracked_documents("session-1")
        self.assertEqual([doc.doc_id for doc in visible_docs], ["session-doc"])

        recovered_store = MultiIndexStore()
        recovered_store._collection = None
        await recovered_store.recover_persisted_documents()

        recovered_docs = await recovered_store.list_tracked_documents("session-1")
        self.assertEqual([doc.doc_id for doc in recovered_docs], ["session-doc"])
        self.assertEqual(
            recovered_docs[0].tier_states[Tier.STARTER],
            DocTierState.QUEUED,
        )

    async def test_session_document_indexes_on_first_tier_use_and_can_rebuild_cache(self) -> None:
        await self.store.register_document(
            doc_id="session-doc",
            filename="session.txt",
            total_chars=11,
            scope="session",
            session_id="session-1",
            source_ext=".txt",
            source_path=str(self.source_path),
        )

        async def fake_ingest_document(*, tier, **_kwargs):
            from app.services.ingestion.chunkers import Chunk

            return [
                Chunk(
                    id=f"{tier.value}-chunk",
                    doc_id=f"session-doc_{tier.value}",
                    content="summary",
                    page=1,
                )
            ]

        with patch(
            "app.services.retrieval_v2.store.ingest_document",
            side_effect=fake_ingest_document,
        ):
            task = self.store.start_tier_ingestion("session-doc", Tier.STARTER)
            self.assertIsNotNone(task)
            await task

            tracked = await self.store.get_tracked_document("session-doc")
            assert tracked is not None
            self.assertEqual(tracked.tier_states[Tier.STARTER], DocTierState.READY)
            self.assertEqual(tracked.tier_states[Tier.PLUS], DocTierState.QUEUED)

            restarted_store = MultiIndexStore()
            restarted_store._collection = None
            await restarted_store.recover_persisted_documents()

            tracked_after_restart = await restarted_store.get_tracked_document("session-doc")
            assert tracked_after_restart is not None
            self.assertEqual(
                tracked_after_restart.tier_states[Tier.STARTER],
                DocTierState.READY,
            )
            self.assertFalse(
                restarted_store.has_indexed_document("session-doc", Tier.STARTER)
            )

            rebuild_task = restarted_store.start_tier_ingestion(
                "session-doc",
                Tier.STARTER,
                force=True,
            )
            self.assertIsNotNone(rebuild_task)
            await rebuild_task
            self.assertTrue(
                restarted_store.has_indexed_document("session-doc", Tier.STARTER)
            )

    async def test_global_document_processes_active_tier_first_then_remaining(self) -> None:
        await self.store.register_document(
            doc_id="global-doc",
            filename="global.txt",
            total_chars=11,
            scope="global",
            source_ext=".txt",
            source_path=str(self.source_path),
        )

        call_order: list[Tier] = []

        async def fake_ingest_document(*, tier, **_kwargs):
            call_order.append(tier)
            from app.services.ingestion.chunkers import Chunk

            return [
                Chunk(
                    id=f"{tier.value}-chunk",
                    doc_id=f"global-doc_{tier.value}",
                    content="global",
                    page=1,
                )
            ]

        with patch(
            "app.services.retrieval_v2.store.ingest_document",
            side_effect=fake_ingest_document,
        ):
            task = self.store.start_global_ingestion_sequence("global-doc", Tier.ENTERPRISE)
            self.assertIsNotNone(task)
            await task

        self.assertEqual(call_order[0], Tier.ENTERPRISE)
        tracked = await self.store.get_tracked_document("global-doc")
        assert tracked is not None
        for tier in Tier:
            self.assertEqual(tracked.tier_states[tier], DocTierState.READY)

    async def test_recovery_resets_stale_processing_state_to_queued(self) -> None:
        await self.store.register_document(
            doc_id="global-doc",
            filename="global.txt",
            total_chars=11,
            scope="global",
            source_ext=".txt",
            source_path=str(self.source_path),
        )

        async with self.session_factory() as session:
            result = await session.execute(
                select(DBDocumentTierState).where(
                    DBDocumentTierState.document_id == "global-doc",
                    DBDocumentTierState.tier == Tier.STARTER.value,
                )
            )
            tier_state = result.scalar_one()
            tier_state.status = DocTierState.PROCESSING.value
            await session.commit()

        recovered_store = MultiIndexStore()
        recovered_store._collection = None
        await recovered_store.recover_persisted_documents()

        tracked = await recovered_store.get_tracked_document("global-doc")
        assert tracked is not None
        self.assertEqual(tracked.tier_states[Tier.STARTER], DocTierState.QUEUED)

    async def test_delete_removes_persisted_document(self) -> None:
        await self.store.register_document(
            doc_id="session-doc",
            filename="session.txt",
            total_chars=11,
            scope="session",
            session_id="session-1",
            source_ext=".txt",
            source_path=str(self.source_path),
        )

        deleted = await self.store.delete_tracked_document("session-doc")
        self.assertIsNotNone(deleted)
        self.assertIsNone(await self.store.get_tracked_document("session-doc"))

        recovered_store = MultiIndexStore()
        recovered_store._collection = None
        await recovered_store.recover_persisted_documents()
        self.assertEqual(await recovered_store.list_tracked_documents("session-1"), [])
