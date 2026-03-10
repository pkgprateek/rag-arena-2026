"""Tier-aware retrieval orchestrator driven by the canonical tier profiles."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import logging
import re

from app.models import Tier
from app.services.ingestion.chunkers import Chunk
from app.services.retrieval_v2.store import store as vector_store
from app.tier_profiles import get_tier_runtime_profile

logger = logging.getLogger(__name__)

_RERANKER = None
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "what",
    "which",
    "with",
}
_LAYOUT_HINTS = {
    "appendix",
    "column",
    "figure",
    "footer",
    "header",
    "layout",
    "page",
    "section",
    "table",
}


@dataclass
class RetrievalOutcome:
    results: list[tuple[Chunk, float]]
    retrieval_mode: str
    rerank_deltas: list[float] = field(default_factory=list)
    hybrid_used: bool = False
    rerank_used: bool = False
    query_orchestration_used: bool = False
    diversity_control_used: bool = False
    enrichment_used: bool = False
    page_aware_used: bool = False
    unique_docs_used: int = 0


def _get_reranker():
    global _RERANKER
    if _RERANKER is None:
        try:
            logger.info(
                "Initializing reranker model (download may occur on first run)..."
            )
            from FlagEmbedding import FlagReranker
            from app.config import settings

            _RERANKER = FlagReranker(settings.reranker_model, use_fp16=True)
            logger.info("Reranker '%s' loaded successfully.", settings.reranker_model)
        except ImportError:
            logger.warning(
                "FlagEmbedding not installed. Reranking will fallback to rank fusion scores."
            )
            return None
    return _RERANKER


def retrieve_context(
    query: str,
    tier: Tier,
    session_id: str = "",
) -> RetrievalOutcome:
    """Execute the retrieval strategy declared by the tier profile."""
    profile = get_tier_runtime_profile(tier)

    if not profile.use_hybrid:
        results = vector_store.vector_search(
            query,
            top_k=profile.final_top_k,
            tier_filter=tier.value,
            session_id=session_id,
        )
        unique_docs = len({_base_doc_id(chunk.doc_id) for chunk, _score in results})
        return RetrievalOutcome(
            results=results,
            retrieval_mode=profile.retrieval_mode,
            unique_docs_used=unique_docs,
        )

    query_plan, query_orchestrated = _build_query_plan(query, profile.use_query_orchestration)
    result_lists: list[list[tuple[Chunk, float]]] = []

    for candidate_query in query_plan:
        result_lists.append(
            vector_store.vector_search(
                candidate_query,
                top_k=profile.dense_top_k,
                tier_filter=tier.value,
                session_id=session_id,
            )
        )
        if profile.sparse_top_k > 0:
            result_lists.append(
                vector_store.keyword_search(
                    candidate_query,
                    top_k=profile.sparse_top_k,
                    tier_filter=tier.value,
                    session_id=session_id,
                )
            )

    fused = _reciprocal_rank_fusion_many(result_lists, top_k=profile.candidate_pool_k)

    if profile.use_adaptive_retrieval:
        fused = _apply_contextual_boosts(query, fused)

    rerank_deltas: list[float] = []
    rerank_used = False
    ranked = fused
    if profile.use_rerank and ranked:
        rerank_used = True
        original_scores = {chunk.id: score for chunk, score in ranked}
        reranked = _bge_rerank(
            query,
            [chunk for chunk, _score in ranked],
            top_k=max(profile.final_top_k * 2, profile.final_top_k),
        )
        rerank_deltas = [
            round(score - original_scores.get(chunk.id, 0.0), 4)
            for chunk, score in reranked[: profile.final_top_k]
        ]
        ranked = reranked

    if profile.use_diversity_control:
        ranked = _apply_diversity_control(
            ranked,
            top_k=profile.final_top_k,
            per_doc_limit=profile.per_doc_limit,
        )
    else:
        ranked = ranked[: profile.final_top_k]

    unique_docs = len({_base_doc_id(chunk.doc_id) for chunk, _score in ranked})
    return RetrievalOutcome(
        results=ranked,
        retrieval_mode=profile.retrieval_mode,
        rerank_deltas=rerank_deltas,
        hybrid_used=profile.use_hybrid,
        rerank_used=rerank_used,
        query_orchestration_used=query_orchestrated,
        diversity_control_used=profile.use_diversity_control,
        enrichment_used=profile.use_enrichment,
        page_aware_used=profile.use_page_aware,
        unique_docs_used=unique_docs,
    )


def _build_query_plan(query: str, enabled: bool) -> tuple[list[str], bool]:
    queries = [query.strip()]
    if not enabled:
        return queries, False

    keyword_query = _keyword_focused_query(query)
    if keyword_query and keyword_query.lower() not in {q.lower() for q in queries}:
        queries.append(keyword_query)

    for part in _decompose_query(query):
        if part.lower() not in {q.lower() for q in queries}:
            queries.append(part)

    return queries[:3], len(queries) > 1


def _keyword_focused_query(query: str) -> str:
    tokens = [
        token
        for token in re.findall(r"[a-z0-9]+", query.lower())
        if token not in _STOPWORDS
    ]
    return " ".join(tokens[:12])


def _decompose_query(query: str) -> list[str]:
    parts = [
        part.strip()
        for part in re.split(r"\b(?:and|versus|vs\.?|compare|between)\b|[,:;]", query, flags=re.IGNORECASE)
    ]
    return [part for part in parts if len(part.split()) >= 3][:2]


def _apply_diversity_control(
    results: list[tuple[Chunk, float]],
    top_k: int,
    per_doc_limit: int,
) -> list[tuple[Chunk, float]]:
    selected: list[tuple[Chunk, float]] = []
    selected_ids: set[str] = set()
    doc_counts: defaultdict[str, int] = defaultdict(int)

    for chunk, score in results:
        doc_id = _base_doc_id(chunk.doc_id)
        if doc_counts[doc_id] > 0:
            continue
        selected.append((chunk, score))
        selected_ids.add(chunk.id)
        doc_counts[doc_id] += 1
        if len(selected) >= top_k:
            return selected

    for chunk, score in results:
        if chunk.id in selected_ids:
            continue
        doc_id = _base_doc_id(chunk.doc_id)
        if doc_counts[doc_id] >= per_doc_limit:
            continue
        selected.append((chunk, score))
        selected_ids.add(chunk.id)
        doc_counts[doc_id] += 1
        if len(selected) >= top_k:
            break

    return selected


def _apply_contextual_boosts(
    query: str,
    results: list[tuple[Chunk, float]],
) -> list[tuple[Chunk, float]]:
    query_tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    boosted: list[tuple[Chunk, float]] = []

    for chunk, score in results:
        boost = 0.0
        if chunk.metadata.get("is_enriched"):
            boost += 0.04

        metadata_tokens = set()
        for key in ("title", "summary", "section"):
            value = chunk.metadata.get(key, "")
            metadata_tokens.update(re.findall(r"[a-z0-9]+", str(value).lower()))

        for key in ("keywords", "questions_answered"):
            value = chunk.metadata.get(key, "")
            metadata_tokens.update(re.findall(r"[a-z0-9]+", str(value).lower()))

        overlap = len(query_tokens & metadata_tokens)
        if overlap:
            boost += min(0.06, overlap * 0.02)

        if query_tokens & _LAYOUT_HINTS:
            if chunk.metadata.get("strategy") == "layout_aware":
                boost += 0.03
            if chunk.metadata.get("is_table"):
                boost += 0.03
            if chunk.metadata.get("page_range"):
                boost += 0.02

        boosted.append((chunk, score + boost))

    boosted.sort(key=lambda item: item[1], reverse=True)
    return boosted


def _bge_rerank(
    query: str, chunks: list[Chunk], top_k: int
) -> list[tuple[Chunk, float]]:
    reranker = _get_reranker()

    if not reranker or not chunks:
        return [(chunk, 0.9 - (i * 0.04)) for i, chunk in enumerate(chunks[:top_k])]

    pairs = [[query, chunk.content] for chunk in chunks]

    try:
        scores = reranker.compute_score(pairs)
        if isinstance(scores, float):
            scores = [scores]

        import math

        def sigmoid(value: float) -> float:
            return 1 / (1 + math.exp(-value))

        normalized_scores = [sigmoid(score) for score in scores]
        scored_chunks = list(zip(chunks, normalized_scores))
        scored_chunks.sort(key=lambda item: item[1], reverse=True)
        return scored_chunks[:top_k]
    except Exception as exc:
        logger.error("Reranking failed: %s", exc)
        return [(chunk, 0.5) for chunk in chunks[:top_k]]


def _reciprocal_rank_fusion_many(
    result_lists: list[list[tuple[Chunk, float]]],
    top_k: int,
    k: int = 60,
) -> list[tuple[Chunk, float]]:
    scores: dict[str, float] = {}
    chunks: dict[str, Chunk] = {}

    for results in result_lists:
        for rank, (chunk, _score) in enumerate(results):
            scores[chunk.id] = scores.get(chunk.id, 0.0) + 1 / (k + rank + 1)
            chunks[chunk.id] = chunk

    fused = [(chunks[chunk_id], score) for chunk_id, score in scores.items()]
    fused.sort(key=lambda item: item[1], reverse=True)
    return fused[:top_k]


def _base_doc_id(doc_id: str) -> str:
    return doc_id.rsplit("_", 1)[0]
