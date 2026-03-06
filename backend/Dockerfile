# Stage 1: Build Stage
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1
# Point HuggingFace to a predictable, writable cache location
ENV HF_HOME=/app/cache
ENV TRANSFORMERS_CACHE=/app/cache

WORKDIR /app

# Install system dependencies needed for FlagEmbedding (OpenMP) and
# zlib-state (C extension that requires gcc to compile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libgomp1 \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first, to leverage Docker cache.
# uv needs the lock file to install; we copy it before the app code so this
# layer is only re-built when dependencies change — not on every code change.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Copy application code
COPY ./app ./app

# Final project install (installs the project itself into the venv)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


# Stage 2: Clean Runtime Stage (no uv, no build tools)
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
# HuggingFace cache — must match the volume mount in docker-compose.yml
ENV HF_HOME=/app/cache
ENV TRANSFORMERS_CACHE=/app/cache
# Chroma's ONNX embedding model cache (separate from HF_HOME)
ENV CHROMA_CACHE_DIR=/app/cache/chroma

# Create a non-root user for security
# Use -m to create a home directory (needed by some HF internals)
RUN groupadd -r appuser && useradd -r -m -g appuser appuser

# Create HF cache directory with correct ownership
RUN mkdir -p /app/cache /app/data && chown -R appuser:appuser /app

# Install minimal runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the pre-built virtual environment and source code
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app/app /app/app

# Drop root privileges
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
