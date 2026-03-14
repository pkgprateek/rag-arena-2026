import unittest
from unittest.mock import Mock, patch

import httpx

from app.config import settings
from app.services.ingestion.chunkers import Chunk
from app.services.reranking import local_llamacpp


def _chunk(doc_id: str, idx: int) -> Chunk:
    return Chunk(
        id=f"{doc_id}:{idx}",
        doc_id=doc_id,
        content=f"content {doc_id} {idx}",
        page=idx + 1,
        metadata={},
    )


class LocalLlamaCppRerankerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._settings_backup = {
            "reranker_enabled": settings.reranker_enabled,
            "reranker_base_url": settings.reranker_base_url,
            "reranker_timeout_seconds": settings.reranker_timeout_seconds,
            "reranker_health_path": settings.reranker_health_path,
            "reranker_api_path": settings.reranker_api_path,
            "reranker_model": settings.reranker_model,
        }
        settings.reranker_enabled = True
        settings.reranker_base_url = "http://127.0.0.1:8081"
        settings.reranker_timeout_seconds = 2.0
        settings.reranker_health_path = "/health"
        settings.reranker_api_path = "/v1/rerank"
        settings.reranker_model = "ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF"

    def tearDown(self) -> None:
        for key, value in self._settings_backup.items():
            setattr(settings, key, value)

    def test_rerank_builds_payload_and_sorts_results(self) -> None:
        response = Mock()
        response.json.return_value = {
            "results": [
                {"index": 0, "relevance_score": 0.2},
                {"index": 2, "relevance_score": 0.9},
                {"index": 1, "relevance_score": 0.7},
            ]
        }
        response.raise_for_status.return_value = None
        client = Mock()
        client.post.return_value = response
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)
        chunks = [_chunk("alpha", 0), _chunk("beta", 0), _chunk("gamma", 0)]

        with patch.object(local_llamacpp.httpx, "Client", return_value=client):
            reranked = local_llamacpp.rerank("policy coverage", chunks, top_k=2)

        self.assertEqual([chunk.id for chunk, _score in reranked], ["gamma:0", "beta:0"])
        client.post.assert_called_once()
        self.assertEqual(
            client.post.call_args.kwargs["json"],
            {
                "model": "ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF",
                "query": "policy coverage",
                "documents": ["content alpha 0", "content beta 0", "content gamma 0"],
            },
        )

    def test_rerank_returns_none_on_timeout(self) -> None:
        client = Mock()
        client.post.side_effect = httpx.ReadTimeout("timed out")
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)

        with patch.object(local_llamacpp.httpx, "Client", return_value=client):
            reranked = local_llamacpp.rerank("policy", [_chunk("alpha", 0)], top_k=1)

        self.assertIsNone(reranked)

    def test_rerank_returns_none_on_malformed_payload(self) -> None:
        response = Mock()
        response.json.return_value = {"results": [{"index": 0}]}
        response.raise_for_status.return_value = None
        client = Mock()
        client.post.return_value = response
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)

        with patch.object(local_llamacpp.httpx, "Client", return_value=client):
            reranked = local_llamacpp.rerank("policy", [_chunk("alpha", 0)], top_k=1)

        self.assertIsNone(reranked)

    def test_probe_health_returns_false_on_connection_error(self) -> None:
        client = Mock()
        client.get.side_effect = httpx.ConnectError("boom")
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)

        with patch.object(local_llamacpp.httpx, "Client", return_value=client):
            healthy = local_llamacpp.probe_health()

        self.assertFalse(healthy)

    def test_probe_health_returns_true_on_success(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        client = Mock()
        client.get.return_value = response
        client.__enter__ = Mock(return_value=client)
        client.__exit__ = Mock(return_value=None)

        with patch.object(local_llamacpp.httpx, "Client", return_value=client):
            healthy = local_llamacpp.probe_health()

        self.assertTrue(healthy)
