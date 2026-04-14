"""Canonical tier profiles for backend behavior and frontend copy."""

from __future__ import annotations

from app.models import Tier, TierProfile, TierRuntimeProfile

TIER_ORDER: list[Tier] = [
    Tier.STARTER,
    Tier.PLUS,
    Tier.ENTERPRISE,
    Tier.MODERN,
]

TIER_RUNTIME_PROFILES: dict[Tier, TierRuntimeProfile] = {
    Tier.STARTER: TierRuntimeProfile(
        id=Tier.STARTER,
        market_position="What most clients think RAG means",
        parse_mode="basic_local_extraction",
        chunk_mode="basic_chunking",
        retrieval_mode="vector_top_k",
        grounding_mode="basic_citations",
        optimization_mode="minimal_optimization",
        eval_trust_mode="baseline_trust_checks",
        ui_summary="Good-enough multi-document RAG with citations for straightforward corpora and normal expectations.",
        generation_temperature=0.45,
        generation_max_tokens=700,
        dense_top_k=4,
        candidate_pool_k=4,
        final_top_k=4,
        per_doc_limit=4,
        system_prompt=(
            "You are a practical RAG assistant representing a credible starter deployment. "
            "Answer the user's question using the retrieved evidence. "
            "Give a concise answer with simple citations by source and page when available. "
            "Do not invent support that is not present in the retrieved context."
        ),
    ),
    Tier.PLUS: TierRuntimeProfile(
        id=Tier.PLUS,
        market_position="The tier most prospects should want",
        parse_mode="rich_doc_parsing",
        chunk_mode="semantic_structure_chunking",
        retrieval_mode="hybrid_diversity_retrieval",
        grounding_mode="page_section_aware_citations",
        optimization_mode="practical_latency_hygiene",
        eval_trust_mode="buyer_visible_quality_checks",
        generation_temperature=0.25,
        generation_max_tokens=1100,
        use_hybrid=True,
        use_diversity_control=True,
        dense_top_k=8,
        sparse_top_k=8,
        candidate_pool_k=10,
        final_top_k=6,
        per_doc_limit=2,
        ui_summary="The biggest visible quality jump: richer parsing, structure-aware chunking, hybrid retrieval, and stronger cross-document balance.",
        system_prompt=(
            "You are a strong production-minded RAG assistant optimized for visible answer quality. "
            "Use the retrieved evidence to produce a clear, well-structured answer. "
            "Synthesize across documents when the evidence supports it. "
            "Cite document, page, and section when available, and explicitly flag unsupported claims."
        ),
    ),
    Tier.ENTERPRISE: TierRuntimeProfile(
        id=Tier.ENTERPRISE,
        market_position="Production-grade for scale and predictability",
        parse_mode="production_rich_doc_parsing",
        chunk_mode="semantic_production_chunking",
        retrieval_mode="orchestrated_hybrid_rerank",
        grounding_mode="strict_grounded_evidence_assembly",
        optimization_mode="semantic_cache_and_latency_controls",
        eval_trust_mode="operational_trust_checks",
        generation_temperature=0.1,
        generation_max_tokens=1800,
        use_hybrid=True,
        use_rerank=True,
        use_query_orchestration=True,
        use_diversity_control=True,
        use_semantic_cache=True,
        strict_grounding=True,
        dense_top_k=18,
        sparse_top_k=18,
        candidate_pool_k=18,
        final_top_k=8,
        per_doc_limit=3,
        ui_summary="Production-grade retrieval reasoning, grounded evidence assembly, semantic caching, and more stable behavior under load.",
        system_prompt=(
            "You are an enterprise RAG assistant used where failure is expensive. "
            "Every material claim must be grounded in retrieved evidence. "
            "Assemble the strongest answer only from supported evidence, prefer corroborated multi-document support, "
            "and abstain clearly when the retrieved context is insufficient. "
            "Keep the answer auditable and predictable."
        ),
    ),
    Tier.MODERN: TierRuntimeProfile(
        id=Tier.MODERN,
        market_position="Document-native and adaptive retrieval",
        parse_mode="document_native_parsing",
        chunk_mode="page_aware_enriched_chunking",
        retrieval_mode="adaptive_document_native_retrieval",
        grounding_mode="strict_grounding_with_richer_document_context",
        optimization_mode="adaptive_retrieval_optimization",
        eval_trust_mode="document_native_trust_checks",
        generation_temperature=0.15,
        generation_max_tokens=2200,
        use_hybrid=True,
        use_rerank=True,
        use_query_orchestration=True,
        use_diversity_control=True,
        use_semantic_cache=True,
        use_enrichment=True,
        use_page_aware=True,
        use_adaptive_retrieval=True,
        strict_grounding=True,
        dense_top_k=24,
        sparse_top_k=24,
        candidate_pool_k=24,
        final_top_k=10,
        per_doc_limit=3,
        ui_summary="Enterprise-grade core plus page-aware indexing, enrichment, contextual metadata retrieval, and more adaptive retrieval behavior.",
        system_prompt=(
            "You are a modern document-native RAG assistant. "
            "Use layout-aware, enriched, and page-sensitive evidence to answer the question. "
            "Prefer the retrieval path that best matches the query and preserve document structure when it matters. "
            "Cite exact pages and sections when possible, synthesize carefully across documents, "
            "and be explicit about uncertainty."
        ),
    ),
}


def get_tier_runtime_profile(tier: Tier) -> TierRuntimeProfile:
    return TIER_RUNTIME_PROFILES[tier]


def get_public_tier_profiles() -> list[TierProfile]:
    return [
        TierProfile.model_validate(TIER_RUNTIME_PROFILES[tier].model_dump())
        for tier in TIER_ORDER
    ]
