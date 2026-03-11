import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.models import DocTierState, Tier
from app.services.retrieval_v2.store import MultiIndexStore


class DocumentRegistryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.store = MultiIndexStore()
        self.store._collection = None
        handle = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
        handle.write(b"hello world")
        handle.close()
        self.path = Path(handle.name)

    async def asyncTearDown(self) -> None:
        self.path.unlink(missing_ok=True)

    async def test_session_document_stays_queued_until_first_tier_use(self) -> None:
        tracked = self.store.register_document(
            doc_id="session-doc",
            filename="session.txt",
            total_chars=11,
            scope="session",
            session_id="session-1",
            source_ext=".txt",
            source_path=str(self.path),
        )

        self.assertEqual(tracked.tier_states[Tier.STARTER], DocTierState.QUEUED)
        self.assertEqual(self.store.count_ready_documents(Tier.STARTER, "session-1"), 0)

        async def fake_ingest_document(*, tier, **_kwargs):
            from app.services.ingestion.chunkers import Chunk

            return [Chunk(id=f"{tier.value}-chunk", doc_id=f"session-doc_{tier.value}", content="x", page=1)]

        with patch(
            "app.services.retrieval_v2.store.ingest_document",
            side_effect=fake_ingest_document,
        ):
            task = self.store.start_tier_ingestion("session-doc", Tier.PLUS)
            self.assertIsNotNone(task)
            await task

        tracked_after = self.store.get_tracked_document("session-doc")
        assert tracked_after is not None
        self.assertEqual(tracked_after.tier_states[Tier.STARTER], DocTierState.QUEUED)
        self.assertEqual(tracked_after.tier_states[Tier.PLUS], DocTierState.READY)

    async def test_global_document_processes_active_tier_first_then_remaining(self) -> None:
        self.store.register_document(
            doc_id="global-doc",
            filename="global.txt",
            total_chars=11,
            scope="global",
            source_ext=".txt",
            source_path=str(self.path),
        )

        call_order: list[Tier] = []

        async def fake_ingest_document(*, tier, **_kwargs):
            call_order.append(tier)
            from app.services.ingestion.chunkers import Chunk

            return [Chunk(id=f"{tier.value}-chunk", doc_id=f"global-doc_{tier.value}", content="x", page=1)]

        with patch(
            "app.services.retrieval_v2.store.ingest_document",
            side_effect=fake_ingest_document,
        ):
            task = self.store.start_global_ingestion_sequence("global-doc", Tier.ENTERPRISE)
            self.assertIsNotNone(task)
            await task

        self.assertEqual(call_order[0], Tier.ENTERPRISE)
        tracked = self.store.get_tracked_document("global-doc")
        assert tracked is not None
        for tier in Tier:
            self.assertEqual(tracked.tier_states[tier], DocTierState.READY)
