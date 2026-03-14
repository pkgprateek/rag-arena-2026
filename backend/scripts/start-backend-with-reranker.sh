#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${RERANKER_MODEL_CACHE_DIR:-/app/cache/reranker}"

MODEL_SLUG="${RERANKER_MODEL:-ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF}"
MODEL_DIR="${RERANKER_MODEL_CACHE_DIR:-/app/cache/reranker}"
MODEL_FILENAME="${RERANKER_MODEL_FILENAME:-qwen3-reranker-0.6b-q8_0.gguf}"
MODEL_PATH="${MODEL_DIR}/${MODEL_FILENAME}"
SERVER_HOST="${RERANKER_SERVER_HOST:-127.0.0.1}"
SERVER_PORT="${RERANKER_SERVER_PORT:-8081}"
RERANKER_ENABLED="${RERANKER_ENABLED:-true}"
LLAMA_SERVER_PID=""
UVICORN_PID=""

cleanup() {
  if [[ -n "${UVICORN_PID}" ]] && kill -0 "${UVICORN_PID}" 2>/dev/null; then
    kill "${UVICORN_PID}" 2>/dev/null || true
  fi
  if [[ -n "${LLAMA_SERVER_PID}" ]] && kill -0 "${LLAMA_SERVER_PID}" 2>/dev/null; then
    kill "${LLAMA_SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "${RERANKER_ENABLED}" == "true" ]]; then
  if [[ ! -f "${MODEL_PATH}" ]]; then
    echo "Downloading reranker model ${MODEL_SLUG} to ${MODEL_PATH}"
    curl --fail --location --retry 3 \
      "https://huggingface.co/${MODEL_SLUG}/resolve/main/${MODEL_FILENAME}?download=1" \
      --output "${MODEL_PATH}"
  fi

  echo "Starting llama.cpp reranker server on ${SERVER_HOST}:${SERVER_PORT}"
  /usr/local/bin/llama-server \
    --host "${SERVER_HOST}" \
    --port "${SERVER_PORT}" \
    --reranking \
    --model "${MODEL_PATH}" &
  LLAMA_SERVER_PID="$!"

  for _ in 1 2 3 4 5; do
    if curl --silent --fail "http://${SERVER_HOST}:${SERVER_PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Local reranker disabled by configuration"
fi

uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 &
UVICORN_PID="$!"
wait "${UVICORN_PID}"
