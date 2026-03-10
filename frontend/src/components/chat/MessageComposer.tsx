// RAG Arena 2026 — Message Composer with per-prompt model selector (Claude-style)

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Upload, ArrowUp, ChevronDown, FileText, X, Loader2 } from "lucide-react";
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
  isDraggingOver?: boolean;
  stagedFiles?: File[];
  onRemoveStagedFile?: (index: number) => void;
  customControls?: React.ReactNode;
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
  isDraggingOver = false,
  stagedFiles = [],
  onRemoveStagedFile,
  customControls,
}: MessageComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && stagedFiles.length === 0) || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend, stagedFiles]);

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
    <div className={`w-full flex justify-center px-4 shrink-0 relative z-10 ${centered ? "pb-0" : "pb-6"}`}>
      <div className={`relative w-full max-w-[760px] pointer-events-auto rounded-[24px] border bg-white px-3 py-2 flex flex-col transition-all font-sans shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] focus-within:shadow-[0_14px_40px_-18px_rgba(15,23,42,0.22)] dark:bg-zinc-900/95
                ${isDraggingOver ? "border-orange-500" : "border-slate-200 dark:border-white/10"}
                focus-within:border-slate-300 dark:focus-within:border-white/15 
                ${centered ? "mb-6 mt-2" : ""}`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[24px] border-2 border-dashed border-orange-500 pointer-events-none">
            <div className="flex items-center justify-center h-10 w-10 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full mb-3">
              <Upload className="h-5 w-5" />
            </div>
            <span className="text-orange-700 dark:text-orange-300 font-semibold text-[15px]">
              Drop files to attach
            </span>
          </div>
        )}

        {customControls && (
          <div className="w-full flex items-center gap-2 px-1 pb-1 pt-0.5 mt-[-2px] h-[34px] shrink-0 overflow-x-auto no-scrollbar mask-gradient-right">
            {customControls}
          </div>
        )}

        <div className="relative w-full">
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
            className="min-h-[68px] w-full resize-none bg-transparent px-3 pt-1 pb-2 text-[15px] leading-7 outline-none focus-visible:ring-0 placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            rows={1}
          />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-2 dark:border-white/5">
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
            {onAttach && (
              <button
                onClick={onAttach}
                disabled={disabled}
                className="flex h-8 items-center gap-2 rounded-full px-3 text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <Upload className="h-4 w-4" />
                <span className="text-[13px] font-medium">Add files</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {stagedFiles.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={disabled}
                    className="flex h-8 items-center gap-1.5 rounded-full px-3 text-orange-600 bg-orange-50 transition-colors hover:bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/20"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-[13px] font-medium">{stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-[280px] p-2 mb-2 bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 rounded-xl max-h-[250px] overflow-y-auto shadow-xl">
                  <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-2 pb-2 pt-1">
                    Attached Files
                  </div>
                  {stagedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-zinc-500" />
                        <span className="text-[13px] text-slate-700 dark:text-zinc-300 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onRemoveStagedFile) onRemoveStagedFile(i);
                        }}
                        className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-md text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20"
                        title="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={handleSend}
              disabled={disabled || (!value.trim() && stagedFiles.length === 0)}
              className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all ${(value.trim() || stagedFiles.length > 0) && !disabled ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200" : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600"
                }`}
            >
              {disabled && (value.trim() || stagedFiles.length > 0) ? (
                <Loader2 className="h-4 w-4 animate-spin outline-none" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
