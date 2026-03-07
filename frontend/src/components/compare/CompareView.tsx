// RAG Arena 2026 — Compare View

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Zap, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CompareViewProps {
    tierResults: Record<string, TierResult>;
    selectedTiers: Tier[];
    onSelectedTiersChange: (tiers: Tier[]) => void;
    onRunCompare: (message: string) => void;
    isRunning: boolean;
}

export function CompareView({
    tierResults,
    selectedTiers,
    onSelectedTiersChange,
    onRunCompare,
    isRunning,
}: CompareViewProps) {
    const [mode, setMode] = useState<"two" | "all">("two");
    const [prompt, setPrompt] = useState("");

    const results = Object.values(tierResults).filter(r => r.run_id);
    const hasInteracted = results.length > 0;

    const tiersToShow = mode === "all" ? TIER_ORDER : selectedTiers;
    const visibleTierSet = new Set(tiersToShow);
    const visibleResults = results.filter((r) => visibleTierSet.has(r.tier));

    const handleCompare = () => {
        if (!prompt.trim() || isRunning) return;
        // Don't allow comparing the exact same tier with itself in 2-up mode
        if (mode === "two" && selectedTiers[0] === selectedTiers[1]) {
            alert("Please select different tiers to compare.");
            return;
        }
        onRunCompare(prompt);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleCompare();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1A1A1A]">
            <ScrollArea className="flex-1 px-6 pb-40 pt-16">
                {!hasInteracted ? (
                    <div className="max-w-4xl mx-auto mt-12 mb-16">
                        <div className="text-center mb-12">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-zinc-100 mb-3">
                                Compare Tiers
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">
                                See how different configurations handle your specific use cases.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {TIER_ORDER.map((tier) => {
                                const config = TIERS[tier];
                                return (
                                    <div key={tier} className="flex flex-col p-5 rounded-2xl bg-slate-50 border border-slate-200 dark:bg-zinc-900/50 dark:border-white/10 relative overflow-hidden group hover:border-sky-300 dark:hover:border-sky-500/50 transition-colors">
                                        <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: config.color }} />
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
                                            <span className="font-semibold text-sm text-slate-800 dark:text-zinc-200">{config.name}</span>
                                            <Badge variant="secondary" className="text-[10px] ml-auto dark:bg-zinc-800 dark:text-zinc-300">{config.label}</Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 flex-1">
                                            {config.description}
                                        </p>
                                        <div className="space-y-2 mt-auto">
                                            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-500">
                                                <span className="flex items-center gap-1.5"><Target className="h-3 w-3" /> Precision</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-500">
                                                <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Speed</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className={`grid gap-6 max-w-6xl mx-auto mt-4 ${tiersToShow.length <= 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-3"}`}>
                        {visibleResults.map((result) => (
                            <div key={result.run_id} className="space-y-4">
                                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm dark:bg-zinc-900/40 dark:border-white/[0.04] h-[500px] flex flex-col mb-4">
                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3 dark:border-white/5">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIERS[result.tier].color }} />
                                        <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 flex-1">{TIERS[result.tier].name}</span>
                                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 dark:border-white/10 dark:text-zinc-500">
                                            {TIERS[result.tier].label}
                                        </Badge>
                                    </div>
                                    <ScrollArea className="flex-1 pr-3">
                                        <div className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                            {result.answer || (
                                                <span className="text-slate-400 dark:text-zinc-500 italic flex items-center gap-2">
                                                    {result.status === "error" ? "Generation failed" : (
                                                        <>Generating response <span className="inline-block w-1.5 h-4 bg-sky-500/80 animate-pulse rounded-sm" /></>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                                <MetricsCard
                                    tier={result.tier}
                                    status={result.status}
                                    metrics={result.metrics}
                                    evalResult={result.eval_result}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Compare Composer */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent dark:from-[#1A1A1A] dark:via-[#1A1A1A] pb-8 pt-12 px-4 z-40 pointer-events-none">
                <div className="max-w-3xl mx-auto pointer-events-auto">
                    {/* Setup Controls */}
                    <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm dark:bg-zinc-900 dark:border-white/10">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setMode("all")}
                                        className={`h-7 px-3 text-[11px] font-medium rounded-full transition-colors ${mode === "all" ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
                                    >
                                        All Tiers
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">Compare all available tiers</TooltipContent>
                            </Tooltip>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMode("two")}
                                className={`h-7 px-3 text-[11px] font-medium rounded-full transition-colors ${mode === "two" ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
                            >
                                Compare Two
                            </Button>
                        </div>

                        {mode === "two" && (
                            <div className="flex items-center gap-2">
                                {[0, 1].map((idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        {idx > 0 && <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium px-1">vs</span>}
                                        <Select
                                            value={selectedTiers[idx]}
                                            onValueChange={(v) => {
                                                const next = [...selectedTiers];
                                                next[idx] = v as Tier;
                                                onSelectedTiersChange(next);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-[140px] text-xs bg-white border-slate-200 rounded-full shadow-sm focus:ring-sky-500 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-200 dark:focus:ring-sky-400/30">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-slate-200 dark:bg-zinc-900 dark:border-white/10 rounded-xl">
                                                {TIER_ORDER.map((t) => (
                                                    <SelectItem key={t} value={t} disabled={idx === 1 && selectedTiers[0] === t} className="text-xs cursor-pointer focus:bg-slate-50 dark:focus:bg-zinc-800 rounded-lg m-1">
                                                        <span className="flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TIERS[t].color }} />
                                                            {TIERS[t].name}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Input Field */}
                    <div className="relative flex flex-col w-full rounded-3xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-sky-100 focus-within:border-sky-300 transition-all dark:bg-zinc-900 dark:border-white/10 dark:focus-within:ring-sky-900/30 dark:focus-within:border-sky-500/30">
                        <textarea
                            rows={1}
                            placeholder="What do you want to compare?"
                            className="w-full resize-none bg-transparent px-5 py-4 text-[15px] outline-none placeholder:text-slate-400 text-slate-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                            value={prompt}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <div className="flex items-center justify-between border-t border-slate-100 p-2 pl-4 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" /> Compare Tiers
                                </span>
                            </div>
                            <Button
                                size="sm"
                                disabled={!prompt.trim() || isRunning}
                                onClick={handleCompare}
                                className={`h-9 px-5 rounded-full font-medium text-sm transition-all shadow-sm flex items-center gap-1.5 ${prompt.trim() ? "bg-sky-500 text-white hover:bg-sky-600 shadow-sky-500/20" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"}`}
                            >
                                {isRunning ? "Comparing..." : "Compare"}
                                {!isRunning && <ArrowRight className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
