# RAG Tier Workflows

This document describes the actual document and retrieval workflows used by the app after the Docling migration.

## Shared Upload Lifecycle

### Global documents

`Upload -> FastAPI /docs/upload -> persist source file -> register document + per-tier states in SQLite -> process active tier immediately -> process remaining tiers sequentially in background -> ready for retrieval`

Technologies:

- FastAPI
- SQLAlchemy + SQLite
- local filesystem under `/app/data/uploads`
- asyncio background tasks

### Session attachments

`Attach to prompt -> upload/register source file -> no processing yet -> first prompt send starts current-tier ingestion for session docs -> retrieval waits for readiness -> later prompts reuse indexed session docs + global docs`

Technologies:

- FastAPI
- SQLAlchemy + SQLite
- local filesystem under `/app/data/uploads`
- asyncio task orchestration

## Tier 1: Starter

`Prompt + visible docs -> ensure current tier ready -> direct text or Docling rich parsing -> fixed-size chunking -> Chroma dense retrieval -> context assembly -> OpenRouter generation -> eval result publish`

Technologies:

- Parsing: direct UTF-8 handling for `.md`, `.txt`, `.json`, `.csv`; Docling for `.pdf`, `.docx`, `.pptx`, `.html`, `.htm`, `.xlsx`
- Chunking: `chunk_fixed_size`
- Dense retrieval: Chroma
- Generation: OpenRouter
- Streaming and state: Redis + SSE

## Tier 2: Plus

`Prompt + visible docs -> ensure current tier ready -> Docling/direct parsing -> semantic chunking -> Chroma dense search + local keyword search -> reciprocal rank fusion -> diversity control -> context assembly with page/section-aware citations -> OpenRouter generation -> eval result publish`

Technologies:

- Parsing: Docling + direct text routing
- Semantic chunking embeddings: OpenRouter embeddings
- Dense retrieval: Chroma
- Sparse retrieval: in-process keyword scoring
- Generation: OpenRouter
- Streaming and state: Redis + SSE

## Tier 3: Enterprise

`Prompt + visible docs -> semantic cache lookup -> ensure current tier ready -> Docling/direct parsing -> semantic chunking -> query orchestration -> dense + sparse retrieval -> reciprocal rank fusion -> local llama.cpp reranking -> diversity control -> strict grounded context assembly -> OpenRouter generation -> eval -> semantic cache write`

Technologies:

- Parsing: Docling + direct text routing
- Semantic chunking embeddings: OpenRouter embeddings
- Semantic cache: Redis + OpenRouter embeddings
- Dense retrieval: Chroma
- Sparse retrieval: in-process keyword scoring
- Reranking: Qwen3 GGUF reranker over localhost HTTP via llama.cpp
- Generation: OpenRouter

## Tier 4: Modern

`Prompt + visible docs -> semantic cache lookup -> ensure current tier ready -> Docling/direct parsing -> layout/page-aware chunking -> LangExtract enrichment -> dense + sparse retrieval -> reciprocal rank fusion -> contextual metadata boosts -> local llama.cpp reranking -> diversity control -> strict document-native context assembly -> OpenRouter generation -> eval -> semantic cache write`

Technologies:

- Parsing: Docling + direct text routing
- Chunking: `chunk_layout_aware`
- Enrichment: `langextract.py`
- Dense retrieval: Chroma
- Sparse retrieval: in-process keyword scoring
- Reranking: Qwen3 GGUF reranker over localhost HTTP via llama.cpp
- Generation: OpenRouter

## Notes

- The app uses OpenRouter embeddings for semantic chunking and semantic cache.
- The app uses Chroma's own embedding path for vector indexing/querying because it stores documents, not precomputed vectors.
- Session documents remain part of the session corpus after first successful indexing.
