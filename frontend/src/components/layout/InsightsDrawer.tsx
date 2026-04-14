// RAG Arena 2026 — Insights Drawer

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { METRIC_LABELS } from "@/lib/constants";
import { useTierCatalog } from "@/hooks/useTierCatalog";
import type { Metrics, EvalResult, Tier } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    Cpu,
    DollarSign,
    FileText,
    TrendingUp,
} from "lucide-react";

interface InsightsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentTier: Tier;
    metrics?: Metrics | null;
    evalResult?: EvalResult | null;
}

export function InsightsDrawer({
    open,
    onOpenChange,
    currentTier,
    metrics,
    evalResult,
}: InsightsDrawerProps) {
    const { tiers } = useTierCatalog();
    const tierConfig = tiers[currentTier];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[310px] bg-slate-50 border-slate-200 p-0 overflow-y-auto dark:bg-[#202123] dark:border-white/[0.06]">
                <SheetHeader className="p-4 pb-0">
                    <SheetTitle className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                        Run Insights
                    </SheetTitle>
                </SheetHeader>

                <div className="p-4 space-y-5">
                    {/* Current tier */}
                    <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-medium">
                            Active Tier
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: tierConfig.color }}
                            />
                            <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                                {tierConfig.name}
                            </span>
                            <Badge
                                variant="outline"
                                className="text-[10px] border-slate-300 text-slate-500 dark:border-white/10 dark:text-zinc-500"
                            >
                                {tierConfig.label}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
                            {tierConfig.description}
                        </p>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-white/[0.06]" />

                    {/* Metrics */}
                    {metrics ? (
                        <div className="space-y-3">
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                Last Run
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <MetricTile
                                    icon={Clock}
                                    label="Latency"
                                    value={`${metrics.latency_ms.toFixed(0)}ms`}
                                />
                                <MetricTile
                                    icon={Cpu}
                                    label="Tokens"
                                    value={`${metrics.prompt_tokens + metrics.completion_tokens}`}
                                />
                                <MetricTile
                                    icon={DollarSign}
                                    label="Cost"
                                    value={`$${metrics.cost_estimate.toFixed(4)}`}
                                />
                                <MetricTile
                                    icon={FileText}
                                    label="Cache"
                                    value={metrics.cache_hit ? "Hit" : "Miss"}
                                />
                                <MetricTile
                                    icon={TrendingUp}
                                    label="Docs"
                                    value={`${metrics.unique_docs_used}`}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-zinc-500">Retrieval Mode</span>
                                    <span className="font-mono text-slate-600 dark:text-zinc-400 tabular-nums">
                                        {metrics.retrieval_mode}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-zinc-500">Retrieval</span>
                                    <span className="font-mono text-slate-600 dark:text-zinc-400 tabular-nums">
                                        {metrics.retrieval_ms.toFixed(0)}ms
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 dark:text-zinc-500">Generation</span>
                                    <span className="font-mono text-slate-600 dark:text-zinc-400 tabular-nums">
                                        {metrics.generation_ms.toFixed(0)}ms
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <TrendingUp className="h-8 w-8 text-slate-500 dark:text-zinc-700 mx-auto mb-2" />
                            <p className="text-xs text-slate-500 dark:text-zinc-600">
                                Send a message to see run metrics here.
                            </p>
                        </div>
                    )}

                    {/* Eval */}
                    {evalResult && (
                        <>
                            <Separator className="bg-slate-200 dark:bg-white/[0.06]" />
                            <div className="space-y-3">
                                <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-medium">
                                    Quality Scores
                                </p>
                                {(
                                    [
                                        ["groundedness", evalResult.groundedness],
                                        ["relevance", evalResult.relevance],
                                        ["citation_coverage", evalResult.citation_coverage],
                                        ["retrieval_precision", evalResult.retrieval_precision],
                                    ] as const
                                ).map(([key, val]) => (
                                    <div key={key} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 dark:text-zinc-500">
                                                {METRIC_LABELS[key]}
                                            </span>
                                            <span className="font-mono text-slate-700 dark:text-zinc-300 tabular-nums">
                                                {Math.round(val * 100)}%
                                            </span>
                                        </div>
                                        <Progress value={val * 100} className="h-1.5" />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function MetricTile({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-1 dark:bg-zinc-900/60 dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-500">
                <Icon className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-mono font-medium text-slate-800 dark:text-zinc-200 tabular-nums">
                {value}
            </p>
        </div>
    );
}
