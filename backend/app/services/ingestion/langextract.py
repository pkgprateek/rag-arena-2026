"""RAG Arena 2026 — LangExtract: LLM-based metadata extraction.

Used by the Modern tier to enrich chunks with LLM-generated metadata:
  - title: Short descriptive title for the chunk
  - summary: 1-2 sentence summary
  - keywords: 3-5 relevant keywords
  - questions_answered: 2-3 questions this chunk can answer

Uses the LANGEXTRACT_MODEL from config (default: google/gemini-2.0-flash).
Falls back to heuristic extraction if LLM call fails.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.db.database import AsyncSessionLocal
from app.services.ingestion.chunkers import Chunk
from app.services.openrouter import (
    OPENROUTER_BASE_URL,
    build_chat_payload,
    normalize_model_spec,
    openrouter_headers,
)
from app.services.runtime_models import get_model_for_capability

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT = """You are a metadata extractor for a RAG system. Given a text chunk from a document, extract structured metadata.

TEXT CHUNK:
{chunk_text}

Return ONLY a JSON object with these fields:
- "title": A short descriptive title (max 10 words)
- "summary": A 1-2 sentence summary of the chunk's content
- "keywords": A list of 3-5 relevant keywords
- "questions_answered": A list of 2-3 questions this chunk can answer

Output ONLY valid JSON, no other text:"""


def _get_langextract_config() -> tuple[str, dict[str, Any] | None] | None:
    if not settings.openrouter_api_key:
        logger.warning("LangExtract: no OpenRouter API key configured.")
        return None

    runtime_model = None
    try:
        import asyncio

        async def _load_runtime_model():
            async with AsyncSessionLocal() as session:
                return await get_model_for_capability(session, "langextract")

        runtime_model = asyncio.run(_load_runtime_model())
    except RuntimeError:
        runtime_model = None
    except Exception as exc:
        logger.warning("LangExtract: failed to resolve runtime model: %s", exc)

    if runtime_model is not None:
        return runtime_model.model_slug, runtime_model.provider_preferences

    model_spec = normalize_model_spec(settings.langextract_model)
    if not model_spec:
        return None
    return model_spec, None


def _extract_heuristic(chunk: Chunk) -> dict[str, Any]:
    """Fallback heuristic metadata when LLM is unavailable."""
    words = chunk.content.split()

    # Simple title: first few meaningful words
    title_words = [w for w in words[:8] if len(w) > 2]
    title = " ".join(title_words[:6]) + ("..." if len(title_words) > 6 else "")

    # Keywords: most distinctive words (longer, likely meaningful)
    keywords = list({w.lower().strip(".,;:!?") for w in words if len(w) > 5})[:5]

    return {
        "title": title,
        "summary": " ".join(words[:30]) + ("..." if len(words) > 30 else ""),
        "keywords": keywords,
        "questions_answered": [],
        "extraction_method": "heuristic",
    }


def _extract_via_llm(
    chunk_text: str, model: str, provider_preferences: Any | None
) -> dict[str, Any] | None:
    """Call LLM to extract metadata. Returns None on failure."""
    prompt = _EXTRACTION_PROMPT.format(chunk_text=chunk_text[:1500])

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=openrouter_headers(),
                json=build_chat_payload(
                    model_slug=model,
                    provider_preferences=provider_preferences,
                    messages=[
                        {
                            "role": "system",
                            "content": "You extract document metadata. Output ONLY valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.0,
                    max_tokens=300,
                ),
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Handle markdown code blocks
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(content)

            # Validate expected fields
            return {
                "title": str(result.get("title", ""))[:100],
                "summary": str(result.get("summary", ""))[:300],
                "keywords": [str(k) for k in result.get("keywords", [])][:5],
                "questions_answered": [
                    str(q) for q in result.get("questions_answered", [])
                ][:3],
                "extraction_method": "llm",
            }

    except Exception as e:
        logger.warning(f"LangExtract LLM call failed: {e}")
        return None


def enrich_chunks(chunks: list[Chunk]) -> list[Chunk]:
    """Enrich chunks with LLM-extracted metadata.

    Processes each chunk sequentially (not batched — keeps it simple and
    avoids rate limits). Falls back to heuristic per-chunk on failure.
    """
    config = _get_langextract_config()
    if config is None:
        logger.warning("LangExtract: no valid model config. Using heuristic fallback.")
        for chunk in chunks:
            chunk.metadata.update(_extract_heuristic(chunk))
            chunk.metadata["is_enriched"] = True
        return chunks

    model, provider_preferences = config
    success_count = 0
    fallback_count = 0

    for chunk in chunks:
        extracted = _extract_via_llm(chunk.content, model, provider_preferences)

        if extracted is not None:
            chunk.metadata.update(extracted)
            success_count += 1
        else:
            chunk.metadata.update(_extract_heuristic(chunk))
            fallback_count += 1

        chunk.metadata["is_enriched"] = True

    logger.info(
        f"LangExtract: enriched {success_count} chunks via LLM, "
        f"{fallback_count} via heuristic fallback."
    )
    return chunks
