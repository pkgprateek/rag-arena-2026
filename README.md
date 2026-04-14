# RAG Arena 2026

RAG Arena 2026 is a full-stack application for comparing four retrieval pipelines side by side on the same documents and questions.

The point of the project is simple: show how answer quality changes when the retrieval system changes, not just the prompt. The app keeps the user experience consistent while varying the document parsing, chunking, retrieval, reranking, and grounding behavior behind each tier.

## What It Does

- Upload documents globally or attach them to a single chat session
- Ask the same question across multiple RAG tiers
- Compare how different retrieval strategies affect citations, grounding, and answer quality
- Stream answers and expose run metrics in the UI

## The Four Tiers

The names are product-facing, but the difference is architectural:

- `Starter`: basic parsing, basic chunking, dense retrieval only
- `Plus`: richer parsing, semantic chunking, hybrid retrieval, stronger citations
- `Enterprise`: deeper retrieval, reranking, stricter grounding, semantic cache
- `Modern`: enterprise core plus layout-aware chunking and enrichment

Detailed workflow notes live in [docs/rag-tier-workflows.md](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/docs/rag-tier-workflows.md).

## Stack

- Frontend: React, Vite, TypeScript, Tailwind
- Backend: FastAPI, SQLAlchemy, Redis, ChromaDB
- Document parsing: Docling plus direct handling for simple text formats
- Reranking: local `llama.cpp`-style reranker service
- LLM and embeddings: OpenRouter-backed model calls
- Local orchestration: Docker Compose

## Repository Layout

```text
.
├── frontend/          React application
├── backend/           FastAPI application
├── docs/              Project documentation
├── docker-compose.yml Local development stack
└── README.md
```

## Running Locally

Prerequisites:

- Docker
- Docker Compose
- An `OPENROUTER_API_KEY`

Steps:

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8089`
- ChromaDB: `http://localhost:8000`
- Redis: `redis://localhost:6379`

## Environment

The root `.env` is used by Docker Compose for local development. At minimum, set:

```env
OPENROUTER_API_KEY=your_key_here
```

Backend defaults and service-specific settings are defined in the backend app itself. If you are changing runtime behavior, start with:

- [backend/app/config.py](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/backend/app/config.py)
- [docker-compose.yml](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/docker-compose.yml)

## Supported Documents

Handled directly:

- `.md`
- `.txt`
- `.json`
- `.csv`

Handled through Docling:

- `.pdf`
- `.docx`
- `.pptx`
- `.html`
- `.htm`
- `.xlsx`

## Development Notes

- The backend persists app state in SQLite under `/app/data` inside the container.
- Chroma and Redis run as separate services in the compose stack.
- Some higher tiers may take longer on first use because richer indexing paths are more expensive than the baseline tier.

## Where To Look Next

- [docs/rag-tier-workflows.md](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/docs/rag-tier-workflows.md) for tier behavior
- [backend/README.md](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/backend/README.md) for backend-specific notes
- [frontend/README.md](/Users/prateekkumargoel/Nandaka/JSR/rag-arena-2026/frontend/README.md) for frontend-specific notes
