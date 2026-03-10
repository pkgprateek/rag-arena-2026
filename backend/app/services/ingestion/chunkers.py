"""RAG Arena 2026 — Document Chunkers.

Tier 1: Fixed-size Chunking
Tier 2: Real Semantic Chunking (embedding similarity breakpoints)
Tier 3: Semantic Chunking (LangExtract metadata added separately)
Tier 4: Layout/Page-aware Chunking (section + page structure preservation)

All chunkers accept list[ParsedElement] from parsers and produce list[Chunk].
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any
from app.services.embeddings import get_embedder
from app.services.ingestion.parsers import ParsedElement

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A minimal chunk structure across all tiers."""

    id: str
    doc_id: str
    content: str
    page: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)


def _make_chunk_id(doc_id: str, index: int) -> str:
    raw = f"{doc_id}:{index}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Tier 1: Fixed-size chunking
# ---------------------------------------------------------------------------


def chunk_fixed_size(
    elements: list[ParsedElement], doc_id: str, chunk_size: int = 500, overlap: int = 50
) -> list[Chunk]:
    """Tier 1: Naive word-level splitting with overlap.

    Concatenates all elements into a single text stream, then splits by word count.
    Preserves the page number from the first element contributing to each chunk.
    """
    if not elements:
        return []

    # Build a flat word list with page tracking
    words_with_page: list[tuple[str, int]] = []
    for el in elements:
        for word in el.text.split():
            words_with_page.append((word, el.page))

    if not words_with_page:
        return []

    chunks: list[Chunk] = []
    index = 0
    pos = 0

    while pos < len(words_with_page):
        window = words_with_page[pos : pos + chunk_size]
        chunk_text = " ".join(w for w, _ in window)
        # Page = the page of the first word in this chunk
        chunk_page = window[0][1]

        chunks.append(
            Chunk(
                id=_make_chunk_id(doc_id, index),
                doc_id=doc_id,
                content=chunk_text,
                page=chunk_page,
                metadata={"strategy": "fixed_size"},
            )
        )
        index += 1
        pos += chunk_size - overlap

    return chunks


# ---------------------------------------------------------------------------
# Tier 2 & 3: Real semantic chunking
# ---------------------------------------------------------------------------


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    import math

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def chunk_semantic(
    elements: list[ParsedElement],
    doc_id: str,
    similarity_threshold: float = 0.5,
) -> list[Chunk]:
    """Tier 2 & 3: Real semantic chunking using embedding similarity.

    Algorithm:
    1. Each ParsedElement is treated as a candidate segment
    2. Embed each segment via async API
    3. Compare adjacent embeddings (cosine similarity)
    4. Merge segments where similarity > threshold (same topic)
    5. Split where similarity drops (topic change)
    """
    if not elements:
        return []

    # Filter out empty elements and prepare segments
    segments = [el for el in elements if el.text.strip()]
    if not segments:
        return []

    embedder = get_embedder()

    # Embed all segments
    texts = [seg.text for seg in segments]
    try:
        embeddings = await embedder.encode(texts)
    except Exception as e:
        logger.warning(f"Embedding failed, falling back to element chunks: {e}")
        return _fallback_element_chunks(segments, doc_id)

    # Find topic boundaries by comparing adjacent embeddings
    chunks: list[Chunk] = []
    current_group: list[ParsedElement] = [segments[0]]
    index = 0

    for i in range(1, len(segments)):
        sim = _cosine_similarity(embeddings[i - 1], embeddings[i])

        if sim >= similarity_threshold:
            # Same topic — merge into current group
            current_group.append(segments[i])
        else:
            # Topic shift — flush current group as a chunk
            chunk = _merge_elements_to_chunk(current_group, doc_id, index)
            chunks.append(chunk)
            index += 1
            current_group = [segments[i]]

    # Flush the last group
    if current_group:
        chunks.append(_merge_elements_to_chunk(current_group, doc_id, index))

    return chunks


def _merge_elements_to_chunk(
    elements: list[ParsedElement], doc_id: str, index: int
) -> Chunk:
    """Merge a group of related elements into a single chunk."""
    combined_text = "\n\n".join(el.text for el in elements)
    # Page = page of the first element in the group
    page = elements[0].page
    # Section = section of the first element that has one
    section = next((el.section for el in elements if el.section), "")
    # Content types present in this chunk
    types = list({el.element_type for el in elements})

    return Chunk(
        id=_make_chunk_id(doc_id, index),
        doc_id=doc_id,
        content=combined_text,
        page=page,
        metadata={
            "strategy": "semantic",
            "section": section,
            "element_types": str(types),
            "page_range": f"{elements[0].page}-{elements[-1].page}",
        },
    )


def _fallback_element_chunks(elements: list[ParsedElement], doc_id: str) -> list[Chunk]:
    """Fallback when embedder is unavailable: one chunk per element."""
    chunks = []
    for i, el in enumerate(elements):
        chunks.append(
            Chunk(
                id=_make_chunk_id(doc_id, i),
                doc_id=doc_id,
                content=el.text,
                page=el.page,
                metadata={
                    "strategy": "semantic_fallback",
                    "section": el.section,
                    "element_type": el.element_type,
                },
            )
        )
    return chunks


# ---------------------------------------------------------------------------
# Tier 4: Layout/Page-aware chunking
# ---------------------------------------------------------------------------


def chunk_layout_aware(elements: list[ParsedElement], doc_id: str) -> list[Chunk]:
    """Tier 4: Preserve document structure — sections, tables, page boundaries.

    Groups elements by section (using Title/Header elements as boundaries).
    Tables are kept as individual chunks to avoid destroying their structure.
    """
    if not elements:
        return []

    chunks: list[Chunk] = []
    index = 0
    current_section = ""
    current_group: list[ParsedElement] = []

    for el in elements:
        if not el.text.strip():
            continue

        # Tables get their own chunk — never merge with text
        if el.element_type == "Table":
            # Flush any accumulated text first
            if current_group:
                chunks.append(
                    _make_layout_chunk(current_group, doc_id, index, current_section)
                )
                index += 1
                current_group = []

            # Table as its own chunk
            chunks.append(
                Chunk(
                    id=_make_chunk_id(doc_id, index),
                    doc_id=doc_id,
                    content=el.text,
                    page=el.page,
                    metadata={
                        "strategy": "layout_aware",
                        "section": current_section or el.section,
                        "element_type": "Table",
                        "is_table": True,
                    },
                )
            )
            index += 1
            continue

        # Section boundary — flush and start new group
        if el.element_type in ("Title", "Header"):
            if current_group:
                chunks.append(
                    _make_layout_chunk(current_group, doc_id, index, current_section)
                )
                index += 1
                current_group = []
            current_section = el.text.strip()

        current_group.append(el)

    # Flush remaining
    if current_group:
        chunks.append(_make_layout_chunk(current_group, doc_id, index, current_section))

    return chunks


def _make_layout_chunk(
    elements: list[ParsedElement], doc_id: str, index: int, section: str
) -> Chunk:
    """Create a layout-aware chunk from a group of elements."""
    combined = "\n\n".join(el.text for el in elements)
    return Chunk(
        id=_make_chunk_id(doc_id, index),
        doc_id=doc_id,
        content=combined,
        page=elements[0].page,
        metadata={
            "strategy": "layout_aware",
            "section": section,
            "element_types": str(list({el.element_type for el in elements})),
            "page_range": f"{elements[0].page}-{elements[-1].page}",
        },
    )
