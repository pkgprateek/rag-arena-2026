"""RAG Arena 2026 — Ingestion Orchestration.

Routes documents through the canonical tier profile:
basic -> richer semantic -> production semantic -> document-native enriched.

DESIGN: only STARTER is ingested on upload. Higher tiers are indexed lazily on
first query so richer parsing and enrichment follow the actual selected tier.
"""

import logging

from app.models import Tier
from app.tier_profiles import get_tier_runtime_profile
from app.services.ingestion.parsers import parse_for_tier
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
    """Process a document end-to-end based on the tier profile."""
    profile = get_tier_runtime_profile(tier)
    elements = parse_for_tier(file_bytes, filename, ext)

    if profile.chunk_mode == "basic_chunking":
        return chunk_fixed_size(elements, doc_id=doc_id)

    if profile.chunk_mode in {
        "semantic_structure_chunking",
        "semantic_production_chunking",
    }:
        return await chunk_semantic(elements, doc_id=doc_id)

    if profile.chunk_mode == "page_aware_enriched_chunking":
        chunks = chunk_layout_aware(elements, doc_id=doc_id)
        return enrich_chunks(chunks) if profile.use_enrichment else chunks

    logger.error("Unknown chunk mode '%s' for tier '%s'", profile.chunk_mode, tier)
    return []
