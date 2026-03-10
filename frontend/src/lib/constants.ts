// RAG Arena 2026 — Shared frontend constants

import type { Tier, TierProfile } from "@/types";

export const API_BASE = "/api";

export const TIER_ORDER: Tier[] = [
  "starter",
  "plus",
  "enterprise",
  "modern",
];

export const DEFAULT_TIER_PROFILES: Record<Tier, TierProfile> = {
  starter: {
    id: "starter",
    market_position: "What most clients think RAG means",
    parse_mode: "basic_local_extraction",
    chunk_mode: "basic_chunking",
    retrieval_mode: "vector_top_k",
    grounding_mode: "basic_citations",
    optimization_mode: "minimal_optimization",
    ui_summary:
      "Good-enough multi-document RAG with citations for straightforward corpora and normal expectations.",
  },
  plus: {
    id: "plus",
    market_position: "The tier most prospects should want",
    parse_mode: "rich_doc_parsing",
    chunk_mode: "semantic_structure_chunking",
    retrieval_mode: "hybrid_diversity_retrieval",
    grounding_mode: "page_section_aware_citations",
    optimization_mode: "practical_latency_hygiene",
    ui_summary:
      "The biggest visible quality jump: richer parsing, structure-aware chunking, hybrid retrieval, and stronger cross-document balance.",
  },
  enterprise: {
    id: "enterprise",
    market_position: "Production-grade for scale and predictability",
    parse_mode: "production_rich_doc_parsing",
    chunk_mode: "semantic_production_chunking",
    retrieval_mode: "orchestrated_hybrid_rerank",
    grounding_mode: "strict_grounded_evidence_assembly",
    optimization_mode: "semantic_cache_and_latency_controls",
    ui_summary:
      "Production-grade retrieval reasoning, grounded evidence assembly, semantic caching, and more stable behavior under load.",
  },
  modern: {
    id: "modern",
    market_position: "Document-native and adaptive retrieval",
    parse_mode: "document_native_parsing",
    chunk_mode: "page_aware_enriched_chunking",
    retrieval_mode: "adaptive_document_native_retrieval",
    grounding_mode: "strict_grounding_with_richer_document_context",
    optimization_mode: "adaptive_retrieval_optimization",
    ui_summary:
      "Enterprise-grade core plus page-aware indexing, enrichment, contextual metadata retrieval, and more adaptive retrieval behavior.",
  },
};

export const TIER_VISUALS: Record<Tier, { color: string; bgGradient: string }> = {
  starter: {
    color: "hsl(214, 90%, 60%)",
    bgGradient: "from-blue-600/30 to-blue-800/50",
  },
  plus: {
    color: "hsl(142, 71%, 45%)",
    bgGradient: "from-emerald-600/30 to-emerald-800/50",
  },
  enterprise: {
    color: "hsl(30, 90%, 55%)",
    bgGradient: "from-orange-600/30 to-orange-800/50",
  },
  modern: {
    color: "hsl(280, 65%, 60%)",
    bgGradient: "from-purple-600/30 to-purple-800/50",
  },
};

export const COPY = {
  heroSubtitle:
    "Compare credible RAG system archetypes, from what most teams ship to the document-native direction serious teams are already adopting.",
  midPageFraming:
    "**Starter** is what most teams actually deliver. **Plus** is the value-anchor upgrade. **Enterprise** is where trust and predictability show up. **Modern** adds document-native, adaptive retrieval on top of that core.",
  ctaTitle: "Want this on your data?",
  ctaBody:
    "Bring a sample corpus and a few target questions. I’ll show you where Starter stops, where Plus pays off, and when Enterprise or Modern actually matter.",
  ctaButton: "Book a call",
} as const;

export const METRIC_LABELS: Record<string, string> = {
  groundedness: "Groundedness",
  relevance: "Answer Relevance",
  citation_coverage: "Citation Coverage",
  retrieval_precision: "Retrieval Precision",
  latency_ms: "Latency",
  cost_estimate: "Est. Cost",
  prompt_tokens: "Prompt Tokens",
  completion_tokens: "Completion Tokens",
  retrieval_ms: "Retrieval Time",
  generation_ms: "Generation Time",
  cache_hit: "Cache Hit",
  retrieval_mode: "Retrieval Mode",
  unique_docs_used: "Docs Used",
  hybrid_used: "Hybrid",
  rerank_used: "Rerank",
  query_orchestration_used: "Orchestrator",
  diversity_control_used: "Diversity",
  enrichment_used: "Enrichment",
  page_aware_used: "Page-aware",
};

export const METRIC_TOOLTIPS: Record<string, string> = {
  groundedness:
    "How well the answer is supported by the retrieved evidence (0–1).",
  relevance: "How relevant the answer is to the original question (0–1).",
  citation_coverage:
    "Percentage of claims in the answer that are backed by citations.",
  retrieval_precision:
    "How many retrieved chunks were actually cited in the answer.",
  latency_ms: "End-to-end response time in milliseconds.",
  cost_estimate: "Estimated API cost for this run.",
  retrieval_mode:
    "The canonical retrieval strategy assigned to this tier profile.",
  unique_docs_used:
    "How many distinct source documents made it into the final retrieval set.",
};
