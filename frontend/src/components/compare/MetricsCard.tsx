// RAG Arena 2026 — Metrics Card

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { METRIC_LABELS, METRIC_TOOLTIPS } from "@/lib/constants";
import { useTierCatalog } from "@/hooks/useTierCatalog";
import type { Metrics, EvalResult, Tier, RunStatus } from "@/types";
import { Progress } from "@/components/ui/progress";
import {
    Zap,
    Target,
    Trophy,
    HelpCircle,
} from "lucide-react";

interface MetricsCardProps {
    tier: Tier;
    status: RunStatus;
    metrics?: Metrics;
    evalResult?: EvalResult;
    winnerBadge?: "fastest" | "most_grounded" | "best_overall" | null;
}

const STATUS_LABELS: Record<RunStatus, string> = {
    queued: "Queued…",
    retrieving: "Retrieving…",
    generating: "Generating…",
    evaluating: "Evaluating…",
    done: "Complete",
    error: "Error",
};

const STATUS_PROGRESS: Record<RunStatus, number> = {
    queued: 10,
    retrieving: 30,
    generating: 60,
    evaluating: 85,
    done: 100,
    error: 100,
};

const WINNER_CONFIG = {
    fastest: { icon: Zap, label: "⚡ Fastest", color: "text-yellow-400" },
    most_grounded: {
        icon: Target,
        label: "🎯 Most Grounded",
        color: "text-blue-400",
    },
    best_overall: {
        icon: Trophy,
        label: "🏆 Best Overall",
        color: "text-amber-400",
    },
};

function MetricRow({
    label,
    value,
    tooltip,
}: {
    label: string;
    value: string | number;
    tooltip?: string;
}) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-500">
                {label}
                {tooltip && (
                    <Tooltip>
                        <TooltipTrigger>
                            <HelpCircle className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-xs">
                            {tooltip}
                        </TooltipContent>
                    </Tooltip>
                )}
            </span>
            <span className="font-mono text-slate-700 dark:text-zinc-300 tabular-nums">{value}</span>
        </div>
    );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
    const percentage = Math.round(value * 100);
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-500">{label}</span>
                <span className="font-mono text-slate-700 dark:text-zinc-300 tabular-nums">
                    {percentage}%
                </span>
            </div>
            <Progress value={percentage} className="h-1.5" />
        </div>
    );
}

export function MetricsCard({
    tier,
    status,
    metrics,
    evalResult,
    winnerBadge,
}: MetricsCardProps) {
    const { tiers } = useTierCatalog();
    const tierConfig = tiers[tier];
    const winner = winnerBadge ? WINNER_CONFIG[winnerBadge] : null;

    return (
        <Card className="bg-white border-slate-200 overflow-hidden dark:bg-zinc-900/60 dark:border-white/[0.06]">
            <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tierConfig.color }}
                        />
                        {tierConfig.name}
                    </CardTitle>
                    {winner && (
                        <Badge
                            variant="outline"
                            className={`text-[10px] ${winner.color} border-current/20`}
                        >
                            {winner.label}
                        </Badge>
                    )}
                </div>

                {/* Progress indicator */}
                {status !== "done" && (
                    <div className="space-y-1 mt-2">
                        <Progress value={STATUS_PROGRESS[status]} className="h-1" />
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500">{STATUS_LABELS[status]}</p>
                    </div>
                )}
            </CardHeader>

            {(metrics || evalResult) && (
                <CardContent className="px-3 pb-3 space-y-3">
                    {/* Performance metrics */}
                    {metrics && (
                        <div className="space-y-1.5">
                            <MetricRow
                                label={METRIC_LABELS.latency_ms}
                                value={`${metrics.latency_ms.toFixed(0)}ms`}
                                tooltip={METRIC_TOOLTIPS.latency_ms}
                            />
                            <MetricRow
                                label={METRIC_LABELS.retrieval_ms}
                                value={`${metrics.retrieval_ms.toFixed(0)}ms`}
                            />
                            <MetricRow
                                label={METRIC_LABELS.generation_ms}
                                value={`${metrics.generation_ms.toFixed(0)}ms`}
                            />
                            <MetricRow
                                label={METRIC_LABELS.prompt_tokens}
                                value={metrics.prompt_tokens}
                            />
                            <MetricRow
                                label={METRIC_LABELS.completion_tokens}
                                value={metrics.completion_tokens}
                            />
                            <MetricRow
                                label={METRIC_LABELS.cost_estimate}
                                value={`$${metrics.cost_estimate.toFixed(4)}`}
                            />
                            <MetricRow
                                label={METRIC_LABELS.cache_hit}
                                value={metrics.cache_hit ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.retrieval_mode}
                                value={metrics.retrieval_mode}
                                tooltip={METRIC_TOOLTIPS.retrieval_mode}
                            />
                            <MetricRow
                                label={METRIC_LABELS.unique_docs_used}
                                value={metrics.unique_docs_used}
                                tooltip={METRIC_TOOLTIPS.unique_docs_used}
                            />
                            <MetricRow
                                label={METRIC_LABELS.hybrid_used}
                                value={metrics.hybrid_used ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.rerank_used}
                                value={metrics.rerank_used ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.query_orchestration_used}
                                value={metrics.query_orchestration_used ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.diversity_control_used}
                                value={metrics.diversity_control_used ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.enrichment_used}
                                value={metrics.enrichment_used ? "Yes" : "No"}
                            />
                            <MetricRow
                                label={METRIC_LABELS.page_aware_used}
                                value={metrics.page_aware_used ? "Yes" : "No"}
                            />
                        </div>
                    )}

                    {/* Eval scores */}
                    {evalResult && (
                        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/[0.04]">
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                Quality
                            </p>
                            <ScoreBar
                                label={METRIC_LABELS.groundedness}
                                value={evalResult.groundedness}
                            />
                            <ScoreBar
                                label={METRIC_LABELS.relevance}
                                value={evalResult.relevance}
                            />
                            <ScoreBar
                                label={METRIC_LABELS.citation_coverage}
                                value={evalResult.citation_coverage}
                            />
                            <ScoreBar
                                label={METRIC_LABELS.retrieval_precision}
                                value={evalResult.retrieval_precision}
                            />
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
