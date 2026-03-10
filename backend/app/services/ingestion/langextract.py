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
from app.services.ingestion.chunkers import Chunk

logger = logging.getLogger(__name__)

# Provider routing — mirrors pipeline.py _parse_provider / _get_api_config exactly
# Format: 'provider/model-name' where model-name may itself contain slashes
# e.g. 'groq/llama-3.3-70b-versatile' or 'openrouter/google/gemini-flash-1.5'
_PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai",
}

_PROVIDER_KEY_ATTRS = {
    "groq": "groq_api_key",
    "openrouter": "openrouter_api_key",
    "google": "google_ai_studio_api_key",
}

_EXTRACTION_PROMPT = """You are a metadata extractor for a RAG system. Given a text chunk from a document, extract structured metadata.

TEXT CHUNK:
{chunk_text}

Return ONLY a JSON object with these fields:
- "title": A short descriptive title (max 10 words)
- "summary": A 1-2 sentence summary of the chunk's content
- "keywords": A list of 3-5 relevant keywords
- "questions_answered": A list of 2-3 questions this chunk can answer

Output ONLY valid JSON, no other text:"""


def _get_langextract_config() -> tuple[str, str, dict[str, str]] | None:
    """Resolve provider, model name, and API config from LANGEXTRACT_MODEL.

    Format: 'provider/model-name' — provider is the first path segment.
    Examples:
      'groq/llama-3.3-70b-versatile'       → provider=groq
      'openrouter/google/gemini-flash-1.5'  → provider=openrouter, model=google/gemini-flash-1.5
      'google/gemini-2.0-flash'             → provider=google
    """
    model_spec = settings.langextract_model
    if not model_spec:
        return None

    if "/" in model_spec:
        provider, model = model_spec.split("/", 1)
        provider = provider.lower()
    else:
        provider, model = "groq", model_spec

    base_url = _PROVIDER_BASE_URLS.get(provider)
    key_attr = _PROVIDER_KEY_ATTRS.get(provider)

    if not base_url or not key_attr:
        logger.warning(f"LangExtract: unknown provider '{provider}'")
        return None

    api_key = getattr(settings, key_attr, "")
    if not api_key:
        logger.warning(f"LangExtract: no API key for provider '{provider}'")
        return None

    return provider, model, {"base_url": base_url, "api_key": api_key}


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
    chunk_text: str, model: str, api_config: dict[str, str]
) -> dict[str, Any] | None:
    """Call LLM to extract metadata. Returns None on failure."""
    prompt = _EXTRACTION_PROMPT.format(chunk_text=chunk_text[:1500])

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{api_config['base_url']}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_config['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You extract document metadata. Output ONLY valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.0,
                    "max_tokens": 300,
                },
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

    _provider, model, api_config = config
    success_count = 0
    fallback_count = 0

    for chunk in chunks:
        extracted = _extract_via_llm(chunk.content, model, api_config)

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
