// RAG Arena 2026 — Shared TypeScript types

export type Tier = "starter" | "plus" | "enterprise" | "modern";
export type DocTierState = "queued" | "processing" | "ready" | "error" | "deleted";

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
    section: string;
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
    parse_mode: string;
    chunk_mode: string;
    retrieval_mode: string;
    grounding_mode: string;
    optimization_mode: string;
    hybrid_used: boolean;
    rerank_used: boolean;
    query_orchestration_used: boolean;
    diversity_control_used: boolean;
    enrichment_used: boolean;
    page_aware_used: boolean;
    unique_docs_used: number;
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
    market_position: string;
    parse_mode: string;
    chunk_mode: string;
    retrieval_mode: string;
    grounding_mode: string;
    optimization_mode: string;
    ui_summary: string;
    name: string;
    label: string;
    description: string;
    color: string;
    bgGradient: string;
}

export interface TierProfile {
    id: Tier;
    market_position: string;
    parse_mode: string;
    chunk_mode: string;
    retrieval_mode: string;
    grounding_mode: string;
    optimization_mode: string;
    ui_summary: string;
}

export interface ProviderPreferences {
    order: string[];
    allow_fallbacks: boolean;
    require_parameters: boolean;
    zdr?: boolean | null;
    only?: string[];
    ignore?: string[];
    sort?: string | null;
    max_price?: Record<string, number> | null;
}

export interface RuntimeModelConfig {
    id: string;
    model_slug: string;
    display_name: string;
    is_enabled: boolean;
    is_default: boolean;
    supports_chat: boolean;
    supports_eval: boolean;
    supports_langextract: boolean;
    supports_embeddings: boolean;
    provider_preferences: ProviderPreferences;
}

export interface SettingsModelsResponse {
    models: RuntimeModelConfig[];
}

export interface RuntimeAppSettings {
    default_chat_model_slug?: string;
    embedding_model_slug?: string;
    reranker_model_slug?: string;
    langextract_model_slug?: string;
    semantic_cache_enabled?: boolean;
    // Deprecated aliases kept temporarily so the unmounted settings page still type-checks.
    embedding_model: string;
    reranker_model: string;
    langextract_model: string;
    semantic_cache_ttl: number;
    semantic_cache_threshold: number;
    calcom_link: string;
}

export interface UpdateRuntimeAppSettingsRequest {
    default_chat_model_slug?: string;
    embedding_model_slug?: string;
    reranker_model_slug?: string;
    langextract_model_slug?: string;
    semantic_cache_enabled?: boolean;
    // Deprecated aliases kept temporarily so the unmounted settings page still type-checks.
    embedding_model?: string;
    reranker_model?: string;
    langextract_model?: string;
    semantic_cache_ttl?: number;
    semantic_cache_threshold?: number;
    calcom_link?: string;
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

export interface SessionMessagePayload {
    id: string;
    role: Role;
    content: string;
    tier?: Tier;
    model?: string;
    run_id?: string;
    citations?: Citation[];
}

export interface PendingSessionAttachment {
    file: File;
}

export interface PendingGlobalUpload {
    id: string;
    fileKey: string;
    filename: string;
    status: "uploading" | "error";
    errorText?: string;
}

export interface DocTierStateInfo {
    status: DocTierState;
    chunks: number;
    error?: string | null;
}

export interface DocListItem {
    doc_id: string;
    filename: string;
    scope: "global" | "session";
    session_id: string;
    current_visibility: "visible" | "hidden";
    tier_states: Record<Tier, DocTierStateInfo>;
    source_status: "persisted" | "deleted";
}

export type GlobalDocRecord = DocListItem & { scope: "global" };
export type SessionDocRecord = DocListItem & { scope: "session" };

export interface DocsListResponse {
    documents: DocListItem[];
    store_stats: Record<string, unknown>;
}

export interface DocUploadResponse {
    doc_id: string;
    filename: string;
    chunks: number;
    scope: "global" | "session";
    session_id: string;
    status: string;
    indexed_tiers: string[];
    tier_states: Record<Tier, DocTierStateInfo>;
    store_stats: Record<string, unknown>;
}

export interface CreateRuntimeModelRequest {
    model_slug: string;
    display_name: string;
    is_enabled: boolean;
    is_default: boolean;
    supports_chat: boolean;
    supports_eval: boolean;
    supports_langextract: boolean;
    supports_embeddings: boolean;
    provider_preferences: ProviderPreferences;
}

export interface UpdateRuntimeModelRequest {
    display_name?: string;
    is_enabled?: boolean;
    is_default?: boolean;
    supports_chat?: boolean;
    supports_eval?: boolean;
    supports_langextract?: boolean;
    supports_embeddings?: boolean;
    provider_preferences?: ProviderPreferences;
}
