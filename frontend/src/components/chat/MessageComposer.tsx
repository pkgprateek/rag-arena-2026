// RAG Arena 2026 — Message Composer with per-prompt model selector (Claude-style)

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Upload, ArrowUp, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MessageComposerProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
    onAttach?: () => void;
    centered?: boolean;
    models?: string[];
    currentModel?: string;
    onModelChange?: (model: string) => void;
}

export function MessageComposer({
    onSend,
    disabled = false,
    placeholder = "Ask anything or search your docs...",
    onAttach,
    centered = false,
    models,
    currentModel,
    onModelChange,
}: MessageComposerProps) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [value, disabled, onSend]);

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

    return (
        <div className={`w-full flex justify-center px-4 ${centered ? "" : "absolute bottom-6 pointer-events-none z-10"}`}>
            <div className={`w-full max-w-[760px] pointer-events-auto rounded-[24px] border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-zinc-900/95 flex flex-col transition-all font-sans shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] focus-within:border-slate-300 focus-within:shadow-[0_14px_40px_-18px_rgba(15,23,42,0.22)] dark:focus-within:border-white/15 ${centered ? "mb-6 mt-2" : ""}`}>
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        handleInput();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="min-h-[72px] w-full resize-none bg-transparent px-3 pt-2 pb-4 text-[15px] leading-7 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    rows={1}
                />
                <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-3 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        {models && models.length > 0 && currentModel && onModelChange && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        disabled={disabled}
                                        className="flex h-8 items-center gap-1.5 rounded-full px-3 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                    >
                                        <span className="max-w-[120px] truncate text-[13px] font-medium">
                                            {currentModel.split("/").pop()?.replace(/-versatile$/, "")}
                                        </span>
                                        <ChevronDown className="h-4 w-4 opacity-70" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="bg-white border-slate-200 min-w-[240px] dark:bg-zinc-900 dark:border-white/[0.08]"
                                >
                                    {models.map((model) => (
                                        <DropdownMenuItem
                                            key={model}
                                            onClick={() => onModelChange(model)}
                                            className={`text-xs font-mono cursor-pointer ${model === currentModel
                                                ? "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10"
                                                : "text-slate-700 dark:text-zinc-300"
                                                }`}
                                        >
                                            {model}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {onAttach ? (
                            <button
                                onClick={onAttach}
                                disabled={disabled}
                                className="flex h-8 items-center gap-2 rounded-full px-3 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                                <Upload className="h-4 w-4" />
                                <span className="text-[13px] font-medium">Add files</span>
                            </button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={disabled || !value.trim()}
                        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all ${value.trim() && !disabled ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200" : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                            }`}
                    >
                        <ArrowUp className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
