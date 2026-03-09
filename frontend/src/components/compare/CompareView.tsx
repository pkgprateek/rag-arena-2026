import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { MetricsCard } from "@/components/compare/MetricsCard";
import { TierShowcase } from "@/components/shared/TierShowcase";
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
import { TIERS, TIER_ORDER } from "@/lib/constants";
import type { Tier, TierResult } from "@/types";

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

  const results = Object.values(tierResults).filter((result) => result.run_id);
  const hasInteracted = results.length > 0;
  const tiersToShow = mode === "all" ? TIER_ORDER : selectedTiers;
  const visibleTierSet = new Set(tiersToShow);
  const visibleResults = results.filter((result) => visibleTierSet.has(result.tier));

  const handleCompare = () => {
    if (!prompt.trim() || isRunning) return;
    if (mode === "two" && selectedTiers[0] === selectedTiers[1]) {
      alert("Please select different tiers to compare.");
      return;
    }
    onRunCompare(prompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleCompare();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#1A1A1A]">
      <ScrollArea className="flex-1 px-4 pb-40 pt-16 sm:px-6">
        {!hasInteracted ? (
          <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-400">
                Compare lab
              </p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[38px]">
                Make the tier differences obvious
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600 dark:text-zinc-300">
                Use the exact same prompt across the stacks and show clients how retrieval quality,
                grounding, and response shape change as the architecture improves.
              </p>
            </div>

            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-3 text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Comparison setup
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Start with all four tiers, then narrow to two when you want a focused side-by-side.
                </p>
              </div>
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
                Retrieval approaches
              </p>
              <TierShowcase highlightedTiers={mode === "all" ? TIER_ORDER : selectedTiers} compact />
            </div>
          </section>
        ) : (
          <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                  Comparison results
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                  Read the answers first, then use the metrics to inspect retrieval quality and speed.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tiersToShow.map((tier) => (
                  <Badge
                    key={tier}
                    variant="secondary"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <span
                      className="mr-2 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: TIERS[tier].color }}
                    />
                    {TIERS[tier].name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visibleResults.map((result, index) => (
                <div
                  key={result.run_id}
                  className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-zinc-900/50">
                    <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: TIERS[result.tier].color }}
                          />
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                            {TIERS[result.tier].name}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                          {TIERS[result.tier].description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 px-2.5 py-1 text-[10px] text-slate-500 dark:border-white/10 dark:text-zinc-400"
                      >
                        {result.status === "done" ? "Complete" : result.status}
                      </Badge>
                    </div>

                    <div className="min-h-[280px] rounded-2xl bg-slate-50 p-4 dark:bg-zinc-950/40">
                      <div className="max-h-[320px] overflow-y-auto pr-2 text-sm leading-7 text-slate-700 dark:text-zinc-200 whitespace-pre-wrap">
                        {result.answer || (
                          <span className="inline-flex items-center gap-2 text-slate-400 dark:text-zinc-500">
                            {result.status === "error" ? (
                              "Generation failed"
                            ) : (
                              <>
                                Generating response
                                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>

                  <MetricsCard
                    tier={result.tier}
                    status={result.status}
                    metrics={result.metrics}
                    evalResult={result.eval_result}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </ScrollArea>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-white via-white to-transparent px-4 pb-8 pt-12 dark:from-[#1A1A1A] dark:via-[#1A1A1A]">
        <div className="pointer-events-auto mx-auto max-w-4xl rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-zinc-900/95">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              One prompt, comparable answers
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-zinc-950">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("all")}
                  className={`h-8 rounded-full px-4 text-xs ${
                    mode === "all"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  All tiers
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("two")}
                  className={`h-8 rounded-full px-4 text-xs ${
                    mode === "two"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  Compare two
                </Button>
              </div>

              {mode === "two" && (
                <>
                  {[0, 1].map((idx) => (
                    <Select
                      key={idx}
                      value={selectedTiers[idx]}
                      onValueChange={(value) => {
                        const next = [...selectedTiers];
                        next[idx] = value as Tier;
                        onSelectedTiersChange(next);
                      }}
                    >
                      <SelectTrigger className="h-9 w-[150px] rounded-full border-slate-200 bg-white text-xs shadow-none focus:ring-orange-500/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-900">
                        {TIER_ORDER.map((tier) => (
                          <SelectItem
                            key={tier}
                            value={tier}
                            disabled={idx === 1 && selectedTiers[0] === tier}
                            className="m-1 rounded-xl text-xs focus:bg-slate-100 dark:focus:bg-zinc-800"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: TIERS[tier].color }}
                              />
                              {TIERS[tier].name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <textarea
              rows={1}
              placeholder="Ask one question you want every tier to answer..."
              aria-label="Compare prompt"
              className="min-h-[76px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              value={prompt}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Start with `All tiers`, then switch to `Compare two` when a client wants a tighter contrast.
              </p>
              <Button
                size="sm"
                disabled={!prompt.trim() || isRunning}
                onClick={handleCompare}
                className={`h-10 rounded-full px-5 text-sm font-medium shrink-0 ${
                  prompt.trim()
                    ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                }`}
              >
                {isRunning ? "Comparing..." : "Compare"}
                {!isRunning && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
