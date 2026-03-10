"""RAG Arena 2026 — Tiered Retrieval Orchestrator.

Retrieval strategy per tier:
  STARTER:    Dense vector search (top 3) — fast, no reranker
  PLUS:       Hybrid search RRF(dense, BM25) (top 5) — better recall
  ENTERPRISE: Deep hybrid + BGE cross-encoder rerank (top 8) — high precision
  MODERN:     Deep hybrid + BGE rerank + enrichment boost (top 10) — best quality
"""

import logging
from app.models import Tier
from app.services.retrieval_v2.store import store as vector_store
from app.services.ingestion.chunkers import Chunk

logger = logging.getLogger(__name__)

# Lazy load the reranker to prevent 1GB download on every fast API worker boot
_RERANKER = None


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
                "FlagEmbedding not installed. Reranking will fallback to RRF."
            )
            return None
    return _RERANKER


def retrieve_context(
    query: str,
    tier: Tier,
    session_id: str = "",
) -> list[tuple[Chunk, float]]:
    """Execute tiered retrieval strategy.

    Args:
        query:      User question.
        tier:       Active tier — controls retrieval depth and reranking.
        session_id: If provided, include session-scoped docs in retrieval.
    """

    if tier == Tier.STARTER:
        # Tier 1: Dense vector search only (fast, no external services)
        return vector_store.vector_search(
            query, top_k=3, tier_filter=tier.value, session_id=session_id
        )

    elif tier == Tier.PLUS:
        # Tier 2: Hybrid dense+sparse with RRF fusion
        dense_results = vector_store.vector_search(
            query, top_k=5, tier_filter=tier.value, session_id=session_id
        )
        sparse_results = vector_store.keyword_search(
            query, top_k=5, tier_filter=tier.value, session_id=session_id
        )
        return _reciprocal_rank_fusion(dense_results, sparse_results, top_k=5)

    elif tier == Tier.ENTERPRISE:
        # Tier 3: Deep hybrid + BGE cross-encoder reranking
        dense_results = vector_store.vector_search(
            query, top_k=15, tier_filter=tier.value, session_id=session_id
        )
        sparse_results = vector_store.keyword_search(
            query, top_k=15, tier_filter=tier.value, session_id=session_id
        )
        fused = _reciprocal_rank_fusion(dense_results, sparse_results, top_k=15)

        chunks_to_rerank = [chunk for chunk, _score in fused]
        return _bge_rerank(query, chunks_to_rerank, top_k=8)

    elif tier == Tier.MODERN:
        # Tier 4: Deep hybrid + BGE rerank + enrichment boost
        dense_results = vector_store.vector_search(
            query, top_k=25, tier_filter=tier.value, session_id=session_id
        )
        sparse_results = vector_store.keyword_search(
            query, top_k=25, tier_filter=tier.value, session_id=session_id
        )
        fused = _reciprocal_rank_fusion(dense_results, sparse_results, top_k=25)

        chunks_to_rerank = [chunk for chunk, _score in fused]
        reranked = _bge_rerank(query, chunks_to_rerank, top_k=12)

        # Boost enriched chunks (LangExtract metadata present → better context)
        boosted = []
        for chunk, score in reranked:
            boost = 0.05 if chunk.metadata.get("is_enriched") else 0
            boosted.append((chunk, score + boost))

        boosted.sort(key=lambda x: x[1], reverse=True)
        return boosted[:10]

    return []


def _bge_rerank(
    query: str, chunks: list[Chunk], top_k: int
) -> list[tuple[Chunk, float]]:
    """Cross-encoder reranking using the configured RERANKER_MODEL."""
    reranker = _get_reranker()

    if not reranker or not chunks:
        # Graceful degradation: return chunks with descending mock scores
        return [(chunk, 0.9 - (i * 0.05)) for i, chunk in enumerate(chunks[:top_k])]

    pairs = [[query, chunk.content] for chunk in chunks]

    try:
        scores = reranker.compute_score(pairs)

        # FlagEmbedding returns a float if there's only 1 pair
        if isinstance(scores, float):
            scores = [scores]

        # Normalize logits to [0, 1] via sigmoid
        import math

        def sigmoid(x: float) -> float:
            return 1 / (1 + math.exp(-x))

        normalized_scores = [sigmoid(s) for s in scores]

        scored_chunks = list(zip(chunks, normalized_scores))
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    except Exception as e:
        logger.error("Reranking failed: %s", e)
        return [(chunk, 0.5) for chunk in chunks[:top_k]]


def _reciprocal_rank_fusion(
    list1: list[tuple[Chunk, float]],
    list2: list[tuple[Chunk, float]],
    top_k: int,
    k: int = 60,
) -> list[tuple[Chunk, float]]:
    """Combine dense and sparse results via Reciprocal Rank Fusion."""
    scores: dict[str, float] = {}
    chunks: dict[str, Chunk] = {}

    for rank, (chunk, _) in enumerate(list1):
        scores[chunk.id] = 1 / (k + rank + 1)
        chunks[chunk.id] = chunk

    for rank, (chunk, _) in enumerate(list2):
        if chunk.id not in scores:
            scores[chunk.id] = 0
            chunks[chunk.id] = chunk
        scores[chunk.id] += 1 / (k + rank + 1)

    fused = [(chunks[cid], score) for cid, score in scores.items()]
    fused.sort(key=lambda x: x[1], reverse=True)
    return fused[:top_k]
