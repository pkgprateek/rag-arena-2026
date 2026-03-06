// RAG Arena 2026 — Chat Message with inline metrics

import { Badge } from "@/components/ui/badge";
import { TIERS } from "@/lib/constants";
import type { Message } from "@/types";
import { User, Bot, Clock, Zap, DollarSign, Target } from "lucide-react";

interface ChatMessageProps {
    message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const tierConfig = message.tier ? TIERS[message.tier] : null;
    const m = message.metrics;
    const ev = message.evalResult;

    return (
        <div
            className={`group flex gap-3 px-4 py-5 ${isUser ? "bg-transparent" : "bg-slate-100/70 dark:bg-white/[0.02]"
                }`}
        >
            {/* Avatar */}
            <div
                className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center mt-0.5 ${isUser
                        ? "bg-slate-200 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                        : "bg-gradient-to-br from-sky-500 to-sky-700 text-white"
                    }`}
            >
                {isUser ? (
                    <User className="h-3.5 w-3.5" />
                ) : (
                    <Bot className="h-3.5 w-3.5" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
                {/* Header: role + tier + model */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        {isUser ? "You" : "Arena"}
                    </span>
                    {tierConfig && !isUser && (
                        <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-white/10"
                            style={{ color: tierConfig.color }}
                        >
                            {tierConfig.name}
                        </Badge>
                    )}
                    {message.model && !isUser && (
                        <span className="text-[10px] text-slate-500 dark:text-zinc-600 font-mono">
                            {message.model}
                        </span>
                    )}
                </div>

                {/* Message body */}
                <div className="text-sm leading-relaxed text-slate-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                    {message.content}
                    {message.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-sky-500/80 ml-0.5 animate-pulse rounded-sm" />
                    )}
                </div>

                {/* Inline metrics bar — shows after streaming completes */}
                {!isUser && !message.isStreaming && m && (
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                        <MetricPill icon={Clock} label={`${m.latency_ms.toFixed(0)}ms`} />
                        <MetricPill
                            icon={Zap}
                            label={`${m.tokens_per_sec.toFixed(0)} tok/s`}
                        />
                        <MetricPill
                            icon={DollarSign}
                            label={`$${m.cost_estimate.toFixed(4)}`}
                        />
                        <MetricPill
                            label={`${m.prompt_tokens + m.completion_tokens} tokens`}
                        />
                        {m.ttft_ms > 0 && (
                            <MetricPill label={`TTFT ${m.ttft_ms.toFixed(0)}ms`} />
                        )}
                        {ev && (
                            <MetricPill
                                icon={Target}
                                label={`${Math.round(ev.groundedness * 100)}% grounded`}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricPill({
    icon: Icon,
    label,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
}) {
    return (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-zinc-500 font-mono tabular-nums bg-slate-200 dark:bg-zinc-900/60 rounded px-1.5 py-0.5">
            {Icon && <Icon className="h-2.5 w-2.5" />}
            {label}
        </span>
    );
}
