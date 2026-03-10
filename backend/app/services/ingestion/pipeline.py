"""RAG Arena 2026 — Ingestion Orchestration.

Routes documents through tier-appropriate parsing → chunking → enrichment.

Tier ingestion costs (external APIs):
  STARTER:    FREE — local pypdf + fixed chunking, no external calls
  PLUS:       Unstructured API (layout parse) + local semantic chunking
  ENTERPRISE: Unstructured API + local semantic chunking + LangExtract (LLM per chunk)
  MODERN:     Unstructured API + layout-preserving chunks + LangExtract (LLM per chunk)

DESIGN: Ingestion is LAZY — only Tier 1 (STARTER) runs on upload. Higher tiers
run the first time a query arrives for that tier, triggered by run_pipeline().
"""

import logging

from app.models import Tier
from app.services.ingestion.parsers import parse_basic, parse_layout_aware
from app.services.ingestion.chunkers import (
    chunk_fixed_size,
    chunk_semantic,
    chunk_layout_aware,
    Chunk,
)
from app.services.ingestion.langextract import enrich_chunks

logger = logging.getLogger(__name__)


async def ingest_document(
    file_bytes: bytes, filename: str, ext: str, doc_id: str, tier: Tier
) -> list[Chunk]:
    """Process a document end-to-end based on the Tier's quality promises.

    External API usage:
      - STARTER:    None (pure local)
      - PLUS:       Unstructured API (layout parse) if key configured, else basic
      - ENTERPRISE: Unstructured API + LangExtract LLM (1 call per chunk)
      - MODERN:     Unstructured API + LangExtract LLM (1 call per chunk)
    """

    if tier == Tier.STARTER:
        # STARTER: Basic pypdf/docx parse + fixed-size chunking — ZERO external APIs
        elements = parse_basic(file_bytes, filename, ext)
        return chunk_fixed_size(elements, doc_id=doc_id)

    elif tier == Tier.PLUS:
        # PLUS: Layout-aware parse (Unstructured API if configured) + semantic chunking
        elements = parse_layout_aware(file_bytes, filename, ext)
        return await chunk_semantic(elements, doc_id=doc_id)

    elif tier == Tier.ENTERPRISE:
        # ENTERPRISE: The production-proven stack (2025-2026).
        # Layout-aware parse + semantic chunks + NO LangExtract.
        # Fast and accurate without per-chunk LLM calls.
        # LLM enrichment happens at query time (reranking + structured evals).
        elements = parse_layout_aware(file_bytes, filename, ext)
        return await chunk_semantic(elements, doc_id=doc_id)

    elif tier == Tier.MODERN:
        # MODERN: Bleeding-edge 2025-2026 concepts.
        # Layout-preserving chunks (PageIndex-style) + LangExtract LLM metadata
        # enrichment per chunk (title, summary, keywords, questions_answered).
        elements = parse_layout_aware(file_bytes, filename, ext)
        chunks = chunk_layout_aware(elements, doc_id=doc_id)
        return enrich_chunks(chunks)  # LangExtract: 1 LLM call per chunk

    # Unreachable if all Tier values handled above
    logger.error("Unknown tier '%s' — returning empty chunk list", tier)
    return []
