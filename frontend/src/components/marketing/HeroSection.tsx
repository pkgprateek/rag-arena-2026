import { ArrowUpRight, FileText, Sparkles } from "lucide-react";
import { TierShowcase } from "@/components/shared/TierShowcase";

interface HeroSectionProps {
  onAnalyze: () => void;
  onCompare: () => void;
}

export function HeroSection({ onAnalyze, onCompare }: HeroSectionProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-400">
          Client-ready RAG demo
        </p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-balance text-slate-900 dark:text-zinc-100 sm:text-[38px]">
          Show clients what better RAG feels like
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600 dark:text-zinc-300">
          Start with a question on the main workspace. When you need to make the differences obvious,
          move into compare and run the same prompt across all four tiers.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-3">
        <button
          onClick={onAnalyze}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <FileText className="h-4 w-4 text-orange-500" />
          Upload documents
        </button>

        <button
          onClick={onCompare}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <Sparkles className="h-4 w-4 text-orange-500" />
          Open compare lab
          <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            What changes across tiers
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
            Each tier reflects a more capable retrieval stack, not just a pricing label.
          </p>
        </div>
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
          Four client-facing implementations
        </p>
        <TierShowcase compact />
      </div>
    </section>
  );
}
