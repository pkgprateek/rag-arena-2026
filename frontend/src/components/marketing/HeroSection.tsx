import { ArrowUpRight, FileText, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onAnalyze: () => void;
  onCompare: () => void;
}

export function HeroSection({ onAnalyze, onCompare }: HeroSectionProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 px-4 pt-16 pb-8 text-center sm:pt-24">
      {/* Eyebrow */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-50/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
          <Sparkles className="h-3 w-3 text-orange-500" />
          Enterprise Knowledge Engine
        </span>
      </div>

      {/* Main Copy */}
      <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 ease-out fill-mode-both">
        <h1 className="text-[36px] font-medium tracking-tight text-balance text-slate-900 dark:text-zinc-50 sm:text-[44px] md:text-[52px] leading-[1.1]">
          Experience intelligent retrieval.
        </h1>
        <p className="mx-auto max-w-[600px] text-base leading-relaxed text-slate-500 dark:text-zinc-400">
          Ask a question on your corpus, then compare the ladder from credible Starter RAG to document-native Modern retrieval.
        </p>
      </div>

      {/* Primary Actions */}
      <div className="flex w-full flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 ease-out fill-mode-both">
        <button
          onClick={onAnalyze}
          className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-800/60 dark:hover:border-white/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 transition-opacity group-hover:opacity-100 dark:from-orange-400/0 dark:via-orange-400/10 dark:to-orange-400/0" />
          <FileText className="h-4 w-4 text-orange-500 transition-transform group-hover:-translate-y-0.5" />
          <span className="relative">Upload documents</span>
        </button>

        <button
          onClick={onCompare}
          className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-800/60 dark:hover:border-white/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 transition-opacity group-hover:opacity-100 dark:from-orange-400/0 dark:via-orange-400/10 dark:to-orange-400/0" />
          <Sparkles className="h-4 w-4 text-orange-500 transition-transform group-hover:rotate-12" />
          <span className="relative">Open compare lab</span>
          <ArrowUpRight className="relative h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-zinc-500" />
        </button>
      </div>

      {/* Ultra-Minimalist Tier Indicators */}
      <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 ease-out fill-mode-both">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
          Available Engines
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {[
            { name: "Starter", dot: "bg-blue-500" },
            { name: "Plus", dot: "bg-emerald-500" },
            { name: "Enterprise", dot: "bg-orange-500" },
            { name: "Modern", dot: "bg-purple-500" },
          ].map((tier) => (
            <div key={tier.name} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} />
              <span className="text-[13px] font-medium text-slate-600 dark:text-zinc-400">
                {tier.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
