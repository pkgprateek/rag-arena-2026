// RAG Arena 2026 — Message Composer with per-prompt model selector (Claude-style)

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Paperclip, ChevronDown, Cpu } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageComposerProps {
    onSend: (message: string, model: string) => void;
    disabled?: boolean;
    placeholder?: string;
    onAttach?: () => void;
    currentModel: string;
    availableModels: string[];
    onModelChange: (model: string) => void;
    centered?: boolean;
}

export function MessageComposer({
    onSend,
    disabled = false,
    placeholder = "Ask a question about your documents…",
    onAttach,
    currentModel,
    availableModels,
    onModelChange,
    centered = false,
}: MessageComposerProps) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed, currentModel);
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [value, disabled, onSend, currentModel]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = () => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }
    };

    // Shorten model name for display e.g. "groq/llama-3.3-70b-versatile" → "llama-3.3-70b"
    const displayModel = currentModel
        ? currentModel.split("/").pop()?.replace(/-versatile$/, "") ?? currentModel
        : "No model";

    return (
        <div
            className={`backdrop-blur-xl p-4 flex-shrink-0 transition-all duration-300 ease-out ${
                centered
                    ? "bg-transparent border-t-0"
                    : "border-t border-slate-200 bg-slate-50/95 dark:border-white/[0.06] dark:bg-[#202123]/90"
            }`}
        >
            <div className={`mx-auto transition-all duration-300 ease-out ${centered ? "max-w-4xl" : "max-w-3xl"}`}>
                <div
                    className={`relative flex flex-col bg-white border border-slate-300 focus-within:border-sky-400 transition-all duration-300 overflow-hidden dark:bg-zinc-900/80 dark:border-white/[0.08] dark:focus-within:border-sky-500/30 ${
                        centered ? "rounded-2xl shadow-lg" : "rounded-xl"
                    }`}
                >
                    {/* Text input */}
                    <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            handleInput();
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        className={`max-h-[260px] resize-none border-0 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pt-3 pb-1 dark:text-zinc-200 dark:placeholder:text-zinc-600 ${
                            centered ? "min-h-[64px]" : "min-h-[44px]"
                        }`}
                    />

                    {/* Bottom toolbar */}
                    <div className="flex items-center justify-between px-2 pb-2 pt-1 gap-2">
                        <div className="flex items-center gap-1">
                            {/* Model picker — per prompt, Claude-style */}
                            {availableModels.length > 0 ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={disabled}
                                            className="h-7 gap-1.5 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5"
                                        >
                                            <Cpu className="h-3 w-3 flex-shrink-0" />
                                            <span className="max-w-[160px] truncate">{displayModel}</span>
                                            <ChevronDown className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        side="top"
                                        className="bg-white border-slate-200 min-w-[240px] mb-1 dark:bg-zinc-900 dark:border-white/[0.08]"
                                    >
                                        {availableModels.map((model) => (
                                            <DropdownMenuItem
                                                key={model}
                                                onClick={() => onModelChange(model)}
                                                className={`text-xs font-mono cursor-pointer ${model === currentModel
                                                        ? "text-cyan-300 bg-cyan-500/10"
                                                        : "text-slate-700 dark:text-zinc-300"
                                                    }`}
                                            >
                                                {model}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <span className="text-[11px] text-slate-500 dark:text-zinc-600 px-2">No models configured</span>
                            )}

                            {/* Attach doc to this session */}
                            {onAttach && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={onAttach}
                                            disabled={disabled}
                                            className="h-7 w-7 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg dark:text-zinc-600 dark:hover:text-zinc-200 dark:hover:bg-white/5"
                                        >
                                            <Paperclip className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Attach doc to this chat</TooltipContent>
                                </Tooltip>
                            )}
                        </div>

                        {/* Send */}
                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={disabled || !value.trim()}
                            className="h-7 w-7 p-0 flex-shrink-0 bg-sky-600 hover:bg-sky-500 text-white rounded-lg disabled:opacity-30 transition-all shadow-sm shadow-sky-500/20"
                        >
                            <SendHorizonal className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-600 mt-2 text-center">
                    Model selection applies to this prompt only. Tier applies to this chat session.
                </p>
            </div>
        </div>
    );
}
