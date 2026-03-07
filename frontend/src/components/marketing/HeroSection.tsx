import { Sparkles, FileText } from "lucide-react";

interface HeroSectionProps {
    onAnalyze: () => void;
    onCompare: () => void;
}

export function HeroSection({ onAnalyze, onCompare }: HeroSectionProps) {
    return (
        <div className="w-full max-w-[700px] mx-auto animate-in fade-in slide-in-from-bottom-8 duration-[1200ms] ease-out px-4 flex flex-col items-center justify-center min-h-[50vh]">
            <h1 className="text-[36px] sm:text-[44px] leading-tight text-slate-800 font-medium mb-12 text-center text-balance dark:text-zinc-100">
                What do you want to explore?
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[600px]">
                <button
                    onClick={onAnalyze}
                    className="p-5 rounded-3xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all font-sans dark:bg-zinc-900/50 dark:border-white/10 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md"
                >
                    <FileText className="h-6 w-6 text-orange-500 mb-4" />
                    <p className="font-medium text-[16px] text-slate-800 mb-1 dark:text-zinc-200">Load sample docs</p>
                    <p className="text-[14px] text-slate-500 dark:text-zinc-400">Add test documents to session</p>
                </button>
                <button
                    onClick={onCompare}
                    className="p-5 rounded-3xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all font-sans dark:bg-zinc-900/50 dark:border-white/10 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md"
                >
                    <Sparkles className="h-6 w-6 text-amber-500 mb-4" />
                    <p className="font-medium text-[16px] text-slate-800 mb-1 dark:text-zinc-200">Compare tiers</p>
                    <p className="text-[14px] text-slate-500 dark:text-zinc-400">Run identical prompts across tiers</p>
                </button>
            </div>
        </div>
    );
}
