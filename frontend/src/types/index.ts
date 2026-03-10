// RAG Arena 2026 — Shared TypeScript types

export type Tier = "starter" | "plus" | "enterprise" | "modern";

export type RunStatus =
    | "queued"
    | "retrieving"
    | "generating"
    | "evaluating"
    | "done"
    | "error";

export type Role = "user" | "assistant" | "system";

export interface Citation {
    doc_id: string;
    page: number;
    snippet: string;
    score: number;
}

export interface EvalResult {
    groundedness: number;
    relevance: number;
    citation_coverage: number;
    retrieval_precision: number;
}

export interface Metrics {
    latency_ms: number;
    retrieval_ms: number;
    generation_ms: number;
    ttft_ms: number;
    tokens_per_sec: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost_estimate: number;
    cache_hit: boolean;
}

export interface Message {
    id: string;
    role: Role;
    content: string;
    tier?: Tier;
    model?: string;
    citations: Citation[];
    run_id?: string;
    isStreaming?: boolean;
    metrics?: Metrics;
    evalResult?: EvalResult;
}

export interface StreamEvent {
    event:
    | "status"
    | "token"
    | "metrics"
    | "citations"
    | "eval_result"
    | "done"
    | "error";
    run_id: string;
    tier?: Tier;
    data: string | Record<string, unknown>;
}

export interface TierConfig {
    id: Tier;
    name: string;
    label: string;
    description: string;
    color: string;
    bgGradient: string;
}

export interface TierResult {
    tier: Tier;
    run_id: string;
    status: RunStatus;
    answer: string;
    citations: Citation[];
    metrics?: Metrics;
    eval_result?: EvalResult;
}

// API request/response types

export interface ChatSendRequest {
    session_id: string;
    message: string;
    tier: Tier;
    model: string;
}

export interface ChatSendResponse {
    message_id: string;
    run_id: string;
    stream_url: string;
}

export interface CompareRunRequest {
    session_id: string;
    message_text: string;
    tiers: Tier[];
    model: string;
}

export interface CompareRunResponse {
    compare_run_id: string;
    stream_url: string;
}

export interface SessionSummary {
    id: string;
    created_at: string;
    tier: Tier;
}
