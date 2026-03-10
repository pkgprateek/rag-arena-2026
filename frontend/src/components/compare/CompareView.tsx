import { useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { MetricsCard } from "@/components/compare/MetricsCard";
import { MessageComposer } from "@/components/chat/MessageComposer";

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
import { useTierCatalog } from "@/hooks/useTierCatalog";
import type { Tier, TierResult, TierConfig } from "@/types";

function TierCard({ config }: { config: TierConfig }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowRef.current.style.setProperty("--mouse-x", `${x}px`);
    glowRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  const handleMouseEnter = () => {
    if (glowRef.current) glowRef.current.style.opacity = "1";
  };

  const handleMouseLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:bg-slate-50/50 dark:border-white/10 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 shadow-sm hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
      tabIndex={0}
      role="button"
      aria-label={`View details for ${config.name}`}
    >
      <div
        ref={glowRef}
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none opacity-0"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 0) var(--mouse-y, 0), color-mix(in srgb, ${config.color} 15%, transparent), transparent 40%)`,
        }}
      />
      <div className="flex flex-col items-start gap-1 relative pointer-events-none w-full">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] opacity-90 transition-transform duration-300 ease-out group-hover:scale-125"
            style={{
              backgroundColor: config.color,
              color: config.color,
            }}
          />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50 tracking-tight">
            {config.name}
          </h3>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-zinc-400">
          {config.description}
        </p>
      </div>
    </div>
  );
}

interface CompareViewProps {
  tierResults: Record<string, TierResult>;
  selectedTiers: Tier[];
  onSelectedTiersChange: (tiers: Tier[]) => void;
  onRunCompare: (message: string) => void;
  isRunning: boolean;
  stagedFiles?: File[];
  onAttach?: () => void;
  onRemoveStagedFile?: (idx: number) => void;
  isDraggingOver?: boolean;
}

export function CompareView({
  tierResults,
  selectedTiers,
  onSelectedTiersChange,
  onRunCompare,
  isRunning,
  stagedFiles = [],
  onAttach,
  onRemoveStagedFile,
  isDraggingOver = false,
}: CompareViewProps) {
  const [mode, setMode] = useState<"two" | "all">("two");
  const { tiers, tierOrder } = useTierCatalog();

  const results = Object.values(tierResults).filter((result) => result.run_id);
  const hasInteracted = results.length > 0;
  const tiersToShow = mode === "all" ? tierOrder : selectedTiers;
  const visibleTierSet = new Set(tiersToShow);
  const visibleResults = results.filter((result) =>
    visibleTierSet.has(result.tier),
  );

  const isRunDisabled =
    isRunning || (mode === "two" && selectedTiers[0] === selectedTiers[1]);

  const handleRunCompare = (msg: string) => {
    if (!msg.trim() || isRunDisabled) return;
    onRunCompare(msg);
  };

  const renderConfigControls = () => (
    <>
      <div className="flex h-8 box-border items-center bg-slate-100/90 dark:bg-zinc-800/60 p-[2px] rounded-full border border-slate-200/60 dark:border-white/10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("all")}
          className={`h-[26px] py-0 rounded-full px-3 text-[12px] transition-[background-color,color,box-shadow] duration-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${mode === "all"
            ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-900 dark:bg-zinc-700 dark:text-zinc-50"
            : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-transparent dark:hover:bg-transparent"
            }`}
        >
          All tiers
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("two")}
          className={`h-[26px] py-0 rounded-full px-3 text-[12px] transition-[background-color,color,box-shadow] duration-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${mode === "two"
            ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-slate-900 dark:bg-zinc-700 dark:text-zinc-50"
            : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-transparent dark:hover:bg-transparent"
            }`}
        >
          Compare 2
        </Button>
      </div>

      {mode === "two" && (
        <div className="flex flex-wrap items-center gap-1.5 ml-0.5">
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
              <SelectTrigger
                size="sm"
                className="flex h-[32px] py-0 w-fit min-w-[96px] items-center justify-between gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 pl-3 pr-2.5 text-[12px] font-medium text-slate-700 shadow-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:border-sky-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80 dark:focus-visible:border-sky-500"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-zinc-900 text-xs shadow-xl">
                {tierOrder.map((tier) => (
                  <SelectItem
                    key={tier}
                    value={tier}
                    disabled={idx === 1 && selectedTiers[0] === tier}
                    className={`rounded-lg px-2.5 py-2 cursor-pointer transition-colors duration-150 ${selectedTiers[idx] === tier
                      ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shadow-[0_0_4px_currentColor]"
                        style={{
                          backgroundColor: tiers[tier].color,
                          color: tiers[tier].color,
                        }}
                      />
                      <span className="font-medium text-[13px] tracking-tight">
                        {tiers[tier].name}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col bg-transparent dark:bg-[#121212] min-h-0 overflow-hidden">
      <ScrollArea className="flex-1 px-4 pb-8 pt-16 sm:px-6 sm:pt-24 min-h-0">
        {!hasInteracted ? (
          <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-12 pt-16 pb-8 text-center sm:pt-24">
            {/* Header Content */}
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                <Sparkles className="h-3 w-3 text-orange-500" />
                Architectural Comparison
              </span>
              <h2 className="text-[36px] font-medium tracking-tight text-balance text-slate-900 dark:text-zinc-50 sm:text-[44px] md:text-[52px] leading-[1.1]">
                Compare real RAG archetypes.
              </h2>
              <p className="mx-auto max-w-[640px] text-base leading-relaxed text-slate-600 dark:text-zinc-400">
                Run the same question across Starter, Plus, Enterprise, and
                Modern to inspect answer quality, grounding, and retrieval
                behavior side-by-side.
              </p>
            </div>

            {/* Tier Definition Cards */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 ease-out fill-mode-both">
              {tierOrder.map((tier) => (
                <TierCard key={tier} config={tiers[tier]} />
              ))}
            </div>
          </section>
        ) : (
          <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                  Comparison Results
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  Read the answers first, then use the metrics to inspect
                  retrieval quality and speed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {visibleResults.map((result, index) => (
                <div
                  key={result.run_id}
                  className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/50">
                    <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: tiers[result.tier].color,
                            }}
                          />
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                            {tiers[result.tier].name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-zinc-400">
                          {tiers[result.tier].description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 px-2.5 py-1 text-[10px] font-medium tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-zinc-300"
                      >
                        {result.status === "done" ? "Complete" : result.status}
                      </Badge>
                    </div>

                    <div className="min-h-[280px] rounded-[16px] bg-slate-50 p-5 dark:bg-zinc-950/60 ring-1 ring-inset ring-slate-100 dark:ring-white/5">
                      <div className="max-h-[320px] overflow-y-auto pr-2 text-[14px] leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                        {result.answer || (
                          <span className="inline-flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                            {result.status === "error" ? (
                              <span className="text-red-500 dark:text-red-400 font-medium">Generation failed</span>
                            ) : (
                              <>
                                <span className="font-mono text-xs uppercase tracking-widest text-sky-600 dark:text-sky-400 animate-pulse">Running analysis</span>
                                <Loader2 className="h-3.5 w-3.5 animate-[spin_1.5s_linear_infinite] text-sky-500" />
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
      <MessageComposer
        onSend={handleRunCompare}
        disabled={isRunDisabled}
        placeholder={
          mode === "two" && selectedTiers[0] === selectedTiers[1]
            ? "Select different tiers to compare..."
            : "Ask a core question to compare these engines..."
        }
        centered={false}
        customControls={renderConfigControls()}
        stagedFiles={stagedFiles}
        onAttach={onAttach}
        onRemoveStagedFile={onRemoveStagedFile}
        isDraggingOver={isDraggingOver}
      />
    </div>
  );
}
