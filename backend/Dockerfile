# Stage 1: Build Stage
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for Python packages with native extensions.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gcc \
    libxcb1 \
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

# Docling runs headless in this service, so swap GUI OpenCV for the headless build.
RUN uv pip uninstall --python /app/.venv/bin/python opencv-python opencv-python-headless || true
RUN uv pip install --python /app/.venv/bin/python --no-cache-dir opencv-python-headless


# Stage 2: Clean Runtime Stage (no uv, no build tools)
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENV HF_HOME=/app/cache
ENV CHROMA_CACHE_DIR=/app/cache/chroma
ENV LD_LIBRARY_PATH="/opt/llama.cpp:${LD_LIBRARY_PATH}"

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -m -g appuser appuser

RUN mkdir -p /app/cache/reranker /app/data /opt/llama.cpp && chown -R appuser:appuser /app

# Install minimal runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxcb1 \
    libglib2.0-0 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 - <<'PY'
import json
import os
import tarfile
import urllib.request

release_url = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
with urllib.request.urlopen(release_url) as response:
    release = json.load(response)

tag = release["tag_name"]
asset_name = f"llama-{tag}-bin-ubuntu-x64.tar.gz"
asset_url = next(
    asset["browser_download_url"]
    for asset in release["assets"]
    if asset["name"] == asset_name
)

archive_path = "/tmp/llama.cpp.tar.gz"
urllib.request.urlretrieve(asset_url, archive_path)
with tarfile.open(archive_path, "r:gz") as archive:
    archive.extractall("/opt/llama.cpp")
os.remove(archive_path)

entries = os.listdir("/opt/llama.cpp")
if len(entries) == 1:
    root = os.path.join("/opt/llama.cpp", entries[0])
    if os.path.isdir(root):
        for name in os.listdir(root):
            os.replace(os.path.join(root, name), os.path.join("/opt/llama.cpp", name))
        os.rmdir(root)
PY

RUN ln -sf /opt/llama.cpp/llama-server /usr/local/bin/llama-server

WORKDIR /app

# Copy the pre-built virtual environment and source code
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app/app /app/app
COPY --chown=appuser:appuser ./scripts/start-backend-with-reranker.sh /app/scripts/start-backend-with-reranker.sh

RUN chmod +x /app/scripts/start-backend-with-reranker.sh

# Drop root privileges
USER appuser

EXPOSE 8000

CMD ["/app/scripts/start-backend-with-reranker.sh"]
