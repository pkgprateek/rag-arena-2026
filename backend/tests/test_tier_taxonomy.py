import unittest
from unittest.mock import patch

from app.models import Tier
from app.services.ingestion.chunkers import Chunk
from app.services.retrieval_v2 import search
from app.tier_profiles import get_public_tier_profiles, get_tier_runtime_profile


def _chunk(doc_id: str, idx: int, **metadata) -> Chunk:
    return Chunk(
        id=f"{doc_id}:{idx}",
        doc_id=doc_id,
        content=f"content {doc_id} {idx}",
        page=idx + 1,
        metadata=metadata,
    )


class TierProfileTests(unittest.TestCase):
    def test_public_profiles_match_expected_feature_boundaries(self) -> None:
        profiles = {profile.id: profile for profile in get_public_tier_profiles()}

        self.assertEqual(set(profiles.keys()), set(Tier))
        self.assertEqual(profiles[Tier.STARTER].retrieval_mode, "vector_top_k")
        self.assertEqual(
            profiles[Tier.PLUS].retrieval_mode,
            "hybrid_diversity_retrieval",
        )
        self.assertEqual(
            profiles[Tier.ENTERPRISE].optimization_mode,
            "semantic_cache_and_latency_controls",
        )
        self.assertEqual(
            profiles[Tier.MODERN].chunk_mode,
            "page_aware_enriched_chunking",
        )

    def test_runtime_profiles_keep_new_taxonomy_split(self) -> None:
        starter = get_tier_runtime_profile(Tier.STARTER)
        plus = get_tier_runtime_profile(Tier.PLUS)
        enterprise = get_tier_runtime_profile(Tier.ENTERPRISE)
        modern = get_tier_runtime_profile(Tier.MODERN)

        self.assertFalse(starter.use_hybrid)
        self.assertTrue(plus.use_hybrid)
        self.assertFalse(plus.use_rerank)
        self.assertTrue(enterprise.use_rerank)
        self.assertTrue(enterprise.use_query_orchestration)
        self.assertFalse(enterprise.use_enrichment)
        self.assertTrue(modern.use_enrichment)
        self.assertTrue(modern.use_page_aware)


class RetrievalBoundaryTests(unittest.TestCase):
    def test_plus_uses_hybrid_diversity_without_rerank(self) -> None:
        dense = [
            (_chunk("alpha_plus", 0), 0.92),
            (_chunk("alpha_plus", 1), 0.88),
            (_chunk("beta_plus", 0), 0.81),
        ]
        sparse = [
            (_chunk("alpha_plus", 2), 0.75),
            (_chunk("gamma_plus", 0), 0.73),
            (_chunk("beta_plus", 1), 0.69),
        ]

        with patch.object(search.vector_store, "vector_search", return_value=dense), patch.object(
            search.vector_store,
            "keyword_search",
            return_value=sparse,
        ):
            outcome = search.retrieve_context("policy coverage", Tier.PLUS)

        self.assertTrue(outcome.hybrid_used)
        self.assertTrue(outcome.diversity_control_used)
        self.assertFalse(outcome.rerank_used)
        self.assertFalse(outcome.query_orchestration_used)
        self.assertGreaterEqual(outcome.unique_docs_used, 2)
        self.assertNotEqual(
            outcome.results[0][0].doc_id.rsplit("_", 1)[0],
            outcome.results[1][0].doc_id.rsplit("_", 1)[0],
        )

    def test_enterprise_adds_rerank_and_query_orchestration(self) -> None:
        dense = [
            (_chunk("alpha_enterprise", 0), 0.92),
            (_chunk("beta_enterprise", 0), 0.85),
            (_chunk("gamma_enterprise", 0), 0.8),
        ]
        sparse = [
            (_chunk("beta_enterprise", 1), 0.79),
            (_chunk("gamma_enterprise", 1), 0.76),
            (_chunk("delta_enterprise", 0), 0.74),
        ]
        reranked = [
            (_chunk("beta_enterprise", 1), 0.97),
            (_chunk("alpha_enterprise", 0), 0.95),
            (_chunk("gamma_enterprise", 0), 0.9),
        ]

        with patch.object(search.vector_store, "vector_search", return_value=dense), patch.object(
            search.vector_store,
            "keyword_search",
            return_value=sparse,
        ), patch.object(
            search,
            "_rerank_with_local_service",
            return_value=(reranked, True),
        ):
            outcome = search.retrieve_context(
                "compare policy and warranty coverage",
                Tier.ENTERPRISE,
            )

        self.assertTrue(outcome.hybrid_used)
        self.assertTrue(outcome.rerank_used)
        self.assertTrue(outcome.query_orchestration_used)
        self.assertTrue(outcome.diversity_control_used)
        self.assertGreaterEqual(outcome.unique_docs_used, 2)
        self.assertTrue(outcome.rerank_deltas)

    def test_modern_marks_page_aware_and_enrichment_usage(self) -> None:
        dense = [
            (_chunk("alpha_modern", 0, strategy="layout_aware", is_enriched=True), 0.9),
            (_chunk("beta_modern", 0, strategy="layout_aware", is_table=True), 0.84),
        ]
        sparse = [
            (_chunk("alpha_modern", 1, section="Appendix", is_enriched=True), 0.82),
            (_chunk("gamma_modern", 0, page_range="2-3"), 0.8),
        ]
        reranked = [
            (_chunk("alpha_modern", 0, strategy="layout_aware", is_enriched=True), 0.96),
            (_chunk("gamma_modern", 0, page_range="2-3"), 0.91),
        ]

        with patch.object(search.vector_store, "vector_search", return_value=dense), patch.object(
            search.vector_store,
            "keyword_search",
            return_value=sparse,
        ), patch.object(
            search,
            "_rerank_with_local_service",
            return_value=(reranked, True),
        ):
            outcome = search.retrieve_context("which page and section cover the appendix table", Tier.MODERN)

        self.assertTrue(outcome.rerank_used)
        self.assertTrue(outcome.query_orchestration_used)
        self.assertTrue(outcome.enrichment_used)
        self.assertTrue(outcome.page_aware_used)

    def test_enterprise_falls_back_to_fused_results_when_reranker_fails(self) -> None:
        dense = [
            (_chunk("alpha_enterprise", 0), 0.92),
            (_chunk("beta_enterprise", 0), 0.85),
        ]
        sparse = [
            (_chunk("gamma_enterprise", 0), 0.79),
        ]
        baseline = search._reciprocal_rank_fusion_many([dense, sparse], top_k=5)

        with patch.object(search, "_build_query_plan", return_value=(["policy coverage"], False)), patch.object(
            search.vector_store,
            "vector_search",
            return_value=dense,
        ), patch.object(
            search.vector_store,
            "keyword_search",
            return_value=sparse,
        ), patch.object(
            search,
            "_rerank_with_local_service",
            side_effect=lambda _query, ranked, top_k: (ranked[:top_k], False),
        ):
            outcome = search.retrieve_context("compare policy and warranty coverage", Tier.ENTERPRISE)

        self.assertFalse(outcome.rerank_used)
        self.assertEqual(outcome.rerank_deltas, [])
        self.assertEqual(
            [chunk.id for chunk, _score in outcome.results],
            [chunk.id for chunk, _score in baseline[: len(outcome.results)]],
        )


if __name__ == "__main__":
    unittest.main()
