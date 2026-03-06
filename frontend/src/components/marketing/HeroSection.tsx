import { COPY } from "@/lib/constants";
import { Sparkles } from "lucide-react";

export function HeroSection() {
    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10 text-center">
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white/80 px-8 py-12 shadow-sm dark:border-white/10 dark:bg-zinc-900/50">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <Sparkles className="h-6 w-6" />
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                    RAG Arena
                </h1>

                <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    {COPY.heroSubtitle}
                </p>
            </div>
        </div>
    );
}
