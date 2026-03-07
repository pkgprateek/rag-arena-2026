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
            <div className={`w-full max-w-[760px] pointer-events-auto bg-white dark:bg-zinc-900 rounded-[28px] p-3 border border-slate-200 dark:border-white/10 flex flex-col focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500/50 focus-within:shadow-md transition-all font-sans shadow-sm hover:shadow-md dark:shadow-none`}>
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
                    className="w-full bg-transparent text-[16px] px-3 pt-2 pb-8 resize-none outline-none placeholder:text-slate-400 dark:text-zinc-100"
                    rows={1}
                />
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        {models && models.length > 0 && currentModel && onModelChange && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        disabled={disabled}
                                        className="flex items-center gap-1.5 h-9 px-3 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
                                    >
                                        <span className="text-[14px] font-medium max-w-[120px] truncate">
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
                                className="flex items-center gap-2 h-9 px-3 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
                            >
                                <Upload className="h-4 w-4" />
                                <span className="text-[14px] font-medium">Add files</span>
                            </button>
                        ) : (
                            <div />
                        )}
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={disabled || !value.trim()}
                        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all ${value.trim() && !disabled ? "bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600" : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                            }`}
                    >
                        <ArrowUp className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
