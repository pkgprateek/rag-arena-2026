// RAG Arena 2026 — Compare View

import { TIERS, TIER_ORDER } from "@/lib/constants";
import type { Tier, TierResult } from "@/types";
import { MetricsCard } from "@/components/compare/MetricsCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, X } from "lucide-react";
import { useState } from "react";

interface CompareViewProps {
    tierResults: Record<string, TierResult>;
    selectedTiers: Tier[];
    onSelectedTiersChange: (tiers: Tier[]) => void;
    onRunCompare: (message: string) => void;
    isRunning: boolean;
    lastUserMessage: string;
    onClose: () => void;
}

function computeWinners(
    results: TierResult[]
): Record<string, "fastest" | "most_grounded" | "best_overall" | null> {
    const doneResults = results.filter((r) => r.status === "done" && r.metrics);
    if (doneResults.length < 2) return {};

    const winners: Record<
        string,
        "fastest" | "most_grounded" | "best_overall" | null
    > = {};

    // Fastest
    const fastest = doneResults.reduce((a, b) =>
        (a.metrics?.latency_ms ?? Infinity) < (b.metrics?.latency_ms ?? Infinity)
            ? a
            : b
    );
    winners[fastest.run_id] = "fastest";

    // Most grounded
    const grounded = doneResults.reduce((a, b) =>
        (a.eval_result?.groundedness ?? 0) > (b.eval_result?.groundedness ?? 0)
            ? a
            : b
    );
    if (!winners[grounded.run_id]) {
        winners[grounded.run_id] = "most_grounded";
    }

    // Best overall (weighted: 40% groundedness + 30% relevance + 30% speed)
    const scored = doneResults.map((r) => {
        const maxLatency = Math.max(...doneResults.map((d) => d.metrics?.latency_ms ?? 0));
        const speedScore = maxLatency > 0
            ? 1 - (r.metrics?.latency_ms ?? maxLatency) / maxLatency
            : 0;
        return {
            ...r,
            score:
                (r.eval_result?.groundedness ?? 0) * 0.4 +
                (r.eval_result?.relevance ?? 0) * 0.3 +
                speedScore * 0.3,
        };
    });
    const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
    if (!winners[best.run_id]) {
        winners[best.run_id] = "best_overall";
    }

    return winners;
}

export function CompareView({
    tierResults,
    selectedTiers,
    onSelectedTiersChange,
    onRunCompare,
    isRunning,
    lastUserMessage,
    onClose,
}: CompareViewProps) {
    const [mode, setMode] = useState<"two" | "all">("two");
    const results = Object.values(tierResults);
    const winners = computeWinners(results);

    const tiersToShow = mode === "all" ? TIER_ORDER : selectedTiers;
    const visibleTierSet = new Set(tiersToShow);
    const visibleResults = results.filter((r) => visibleTierSet.has(r.tier));

    return (
        <div className="flex flex-col h-full bg-slate-100/95 backdrop-blur-xl dark:bg-[#202123]/95">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                        Compare Tiers
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-200"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* Mode toggle */}
                <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(v) => v && setMode(v as "two" | "all")}
                    className="mb-3"
                >
                    <ToggleGroupItem
                        value="two"
                        className="text-xs h-7 data-[state=on]:bg-sky-500/20 data-[state=on]:text-sky-300"
                    >
                        2-Up
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        value="all"
                        className="text-xs h-7 data-[state=on]:bg-sky-500/20 data-[state=on]:text-sky-300"
                    >
                        All Tiers
                    </ToggleGroupItem>
                </ToggleGroup>

                {/* Tier selectors (2-up mode) */}
                {mode === "two" && (
                    <div className="flex gap-2">
                        {[0, 1].map((idx) => (
                            <Select
                                key={idx}
                                value={selectedTiers[idx]}
                                onValueChange={(v) => {
                                    const next = [...selectedTiers];
                                    next[idx] = v as Tier;
                                    onSelectedTiersChange(next);
                                }}
                            >
                                <SelectTrigger className="h-7 text-xs bg-white border-slate-300 dark:bg-zinc-900/60 dark:border-white/[0.08]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 dark:bg-zinc-900 dark:border-white/[0.08]">
                                    {TIER_ORDER.map((t) => (
                                        <SelectItem key={t} value={t} className="text-xs">
                                            <span className="flex items-center gap-1.5">
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full"
                                                    style={{ backgroundColor: TIERS[t].color }}
                                                />
                                                {TIERS[t].name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ))}
                    </div>
                )}

                {/* Run button */}
                <Button
                    size="sm"
                    onClick={() => onRunCompare(lastUserMessage)}
                    disabled={isRunning || !lastUserMessage}
                    className="w-full mt-3 h-8 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs gap-1.5"
                >
                    <Play className="h-3 w-3" />
                    {isRunning ? "Running…" : "Run Compare"}
                </Button>
            </div>

            {/* Results */}
            <ScrollArea className="flex-1 p-4">
                <div
                    className={`grid gap-4 ${tiersToShow.length <= 2 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
                        }`}
                >
                    {visibleResults.length === 0 ? (
                        <div className="col-span-full text-center text-slate-500 dark:text-zinc-600 text-sm py-12">
                            Select tiers and click "Run Compare" to see results side by side.
                        </div>
                    ) : (
                        visibleResults.map((result) => (
                            <div key={result.run_id} className="space-y-3">
                                {/* Answer */}
                                <div className="rounded-lg bg-white border border-slate-200 p-3 dark:bg-zinc-900/40 dark:border-white/[0.04]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] border-white/10"
                                            style={{ color: TIERS[result.tier].color }}
                                        >
                                            {TIERS[result.tier].name}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 dark:border-white/10 dark:text-zinc-500">
                                            {TIERS[result.tier].label}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-slate-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                        {result.answer || (
                                            <span className="text-slate-500 dark:text-zinc-600 italic">
                                                {result.status === "error"
                                                    ? "Generation failed"
                                                    : "Waiting for response…"}
                                            </span>
                                        )}
                                        {result.status !== "done" && result.status !== "error" && (
                                            <span className="inline-block w-1.5 h-4 bg-sky-500/80 ml-0.5 animate-pulse rounded-sm" />
                                        )}
                                    </div>
                                </div>

                                {/* Metrics */}
                                <MetricsCard
                                    tier={result.tier}
                                    status={result.status}
                                    metrics={result.metrics}
                                    evalResult={result.eval_result}
                                    winnerBadge={winners[result.run_id] || null}
                                />
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
