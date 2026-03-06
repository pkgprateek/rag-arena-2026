// RAG Arena 2026 — Constants & tier configuration

import type { Tier, TierConfig } from "@/types";

export const API_BASE = "/api";

export const TIERS: Record<Tier, TierConfig> = {
    starter: {
        id: "starter",
        name: "Starter",
        label: "Starter",
        description:
            "Simple RAG most clients ask for first: basic parsing, fixed chunking, and dense vector retrieval.",
        color: "hsl(214, 90%, 60%)",
        bgGradient: "from-blue-600/30 to-blue-800/50",
    },
    plus: {
        id: "plus",
        name: "Plus",
        label: "Plus",
        description:
            "Optimized RAG: Unstructured parsing, semantic chunking, and hybrid dense+sparse retrieval for better grounding.",
        color: "hsl(142, 71%, 45%)",
        bgGradient: "from-emerald-600/30 to-emerald-800/50",
    },
    enterprise: {
        id: "enterprise",
        name: "Enterprise",
        label: "Enterprise",
        description:
            "Production architecture used by strong teams: deep hybrid retrieval, BGE reranking, strict grounded outputs, and semantic caching.",
        color: "hsl(30, 90%, 55%)",
        bgGradient: "from-orange-600/30 to-orange-800/50",
    },
    modern: {
        id: "modern",
        name: "Modern",
        label: "Modern",
        description:
            "Modern 2025-2026 concepts: layout/page-aware chunking, LangExtract enrichment, and retrieval-time metadata boosts.",
        color: "hsl(280, 65%, 60%)",
        bgGradient: "from-purple-600/30 to-purple-800/50",
    },
};

export const TIER_ORDER: Tier[] = [
    "starter",
    "plus",
    "enterprise",
    "modern",
];

export const COPY = {
    heroSubtitle:
        "RAG isn't just retrieval. It's accuracy, latency, and reliability under real workloads.",
    midPageFraming: `**Starter** is what most Upwork implementations deliver.
**Plus / Enterprise / Modern** show what you get when you optimize for outcomes: grounded answers, lower latency, and production-grade tracing.`,
    ctaTitle: "Want this on your data?",
    ctaBody:
        "Bring a sample corpus and a few target questions — I'll show you what Enterprise/Modern RAG looks like in your environment.",
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
};
