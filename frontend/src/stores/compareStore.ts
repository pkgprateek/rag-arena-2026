// RAG Arena 2026 — Compare state (Zustand)

import { create } from "zustand";
import type { Tier, TierResult, Metrics, EvalResult } from "@/types";

interface CompareState {
    isCompareMode: boolean;
    selectedTiers: Tier[];
    compareRunId: string | null;
    tierResults: Record<string, TierResult>;
    showPostCompareCTA: boolean;

    setCompareMode: (v: boolean) => void;
    setSelectedTiers: (tiers: Tier[]) => void;
    setCompareRunId: (id: string) => void;
    initTierResult: (tier: Tier, runId: string) => void;
    updateTierStatus: (runId: string, status: TierResult["status"]) => void;
    appendTierToken: (runId: string, token: string) => void;
    setTierMetrics: (runId: string, metrics: Metrics) => void;
    setTierEval: (runId: string, evalResult: EvalResult) => void;
    markTierDone: (runId: string) => void;
    setShowPostCompareCTA: (v: boolean) => void;
    reset: () => void;
}

export const useCompareStore = create<CompareState>((set) => ({
    isCompareMode: false,
    selectedTiers: ["starter", "plus"] as Tier[],
    compareRunId: null,
    tierResults: {},
    showPostCompareCTA: false,

    setCompareMode: (v) => set({ isCompareMode: v }),
    setSelectedTiers: (tiers) => set({ selectedTiers: tiers }),
    setCompareRunId: (id) => set({ compareRunId: id }),

    initTierResult: (tier, runId) =>
        set((s) => ({
            tierResults: {
                ...s.tierResults,
                [runId]: {
                    tier,
                    run_id: runId,
                    status: "queued",
                    answer: "",
                    citations: [],
                },
            },
        })),

    updateTierStatus: (runId, status) =>
        set((s) => {
            const existing = s.tierResults[runId];
            if (!existing) return s;
            return {
                tierResults: {
                    ...s.tierResults,
                    [runId]: { ...existing, status },
                },
            };
        }),

    appendTierToken: (runId, token) =>
        set((s) => {
            const existing = s.tierResults[runId];
            if (!existing) return s;
            return {
                tierResults: {
                    ...s.tierResults,
                    [runId]: { ...existing, answer: existing.answer + token },
                },
            };
        }),

    setTierMetrics: (runId, metrics) =>
        set((s) => {
            const existing = s.tierResults[runId];
            if (!existing) return s;
            return {
                tierResults: {
                    ...s.tierResults,
                    [runId]: { ...existing, metrics },
                },
            };
        }),

    setTierEval: (runId, evalResult) =>
        set((s) => {
            const existing = s.tierResults[runId];
            if (!existing) return s;
            return {
                tierResults: {
                    ...s.tierResults,
                    [runId]: { ...existing, eval_result: evalResult },
                },
            };
        }),

    markTierDone: (runId) =>
        set((s) => {
            const existing = s.tierResults[runId];
            if (!existing) return s;
            return {
                tierResults: {
                    ...s.tierResults,
                    [runId]: { ...existing, status: "done" },
                },
            };
        }),

    setShowPostCompareCTA: (v) => set({ showPostCompareCTA: v }),

    reset: () =>
        set({
            isCompareMode: false,
            compareRunId: null,
            tierResults: {},
            showPostCompareCTA: false,
        }),
}));
