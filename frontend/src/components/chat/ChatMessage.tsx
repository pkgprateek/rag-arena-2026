// RAG Arena 2026 — Chat Message with inline metrics

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TIERS } from "@/lib/constants";
import type { Message } from "@/types";
import { Sparkles } from "lucide-react";

interface ChatMessageProps {
    message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const tierConfig = message.tier ? TIERS[message.tier] : null;

    const [displayedContent, setDisplayedContent] = useState("");

    useEffect(() => {
        if (!message.isStreaming) {
            setDisplayedContent(message.content);
            return;
        }

        let animationFrame: number;
        const animate = () => {
            setDisplayedContent((prev) => {
                if (prev.length < message.content.length) {
                    const diff = message.content.length - prev.length;
                    const step = Math.max(1, Math.ceil(diff / 3));
                    return message.content.slice(0, prev.length + step);
                }
                return prev;
            });
            animationFrame = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(animationFrame);
    }, [message.content, message.isStreaming]);
    return (
        <div
            className={`flex flex-col px-4 py-4 w-full ${isUser ? "items-end" : "items-start"}`}
        >
            {isUser ? (
                <div className="bg-slate-50 dark:bg-zinc-800 text-slate-900 border border-slate-200 dark:border-white/10 dark:text-zinc-100 rounded-3xl px-6 py-4 text-[16px] max-w-[85%] font-sans leading-relaxed shadow-sm">
                    {displayedContent}
                </div>
            ) : (
                <div className="flex gap-4 max-w-[95%]">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shrink-0 shadow-sm mt-1 text-white">
                        <Sparkles className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                        {/* Header: role + tier + model */}
                        <div className="flex items-center gap-2 flex-wrap mb-1 pt-1 opacity-70">
                            {tierConfig && (
                                <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 h-4 border-white/10 uppercase tracking-wider font-semibold"
                                    style={{ color: tierConfig.color }}
                                >
                                    {tierConfig.name}
                                </Badge>
                            )}
                            {message.model && (
                                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                                    {message.model}
                                </span>
                            )}
                        </div>

                        {/* Content */}
                        <div className="text-[16px] text-slate-800 dark:text-zinc-200 leading-[1.7] whitespace-pre-wrap break-words pb-6">
                            {displayedContent}
                            {message.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-orange-400 ml-0.5 animate-pulse rounded-sm" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
