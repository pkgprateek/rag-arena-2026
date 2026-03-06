// RAG Arena 2026 — Document Upload Modal (Global & Session scope)

import { useRef, useState } from "react";
import { Upload, X, FileText, Trash2, Globe, MessageSquare, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { api } from "@/lib/api";

interface UploadedDoc {
    doc_id: string;
    filename: string;
    chunks: number;
    scope: "global" | "session";
}

interface UploadModalProps {
    globalDocs: UploadedDoc[];
    sessionDocs: UploadedDoc[];
    onDocUploaded: (doc: UploadedDoc) => void;
    onDocRemoved: (docId: string) => void;
}

export function UploadModal({
    globalDocs,
    sessionDocs,
    onDocUploaded,
    onDocRemoved,
}: UploadModalProps) {
    const ui = useUIStore();
    const chat = useChatStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const activeScope = ui.uploadModalScope;
    const docs = activeScope === "global" ? globalDocs : sessionDocs;

    const handleFile = async (file: File) => {
        if (uploading) return;
        setUploadResult(null);
        setUploading(true);
        try {
            const result = await api.uploadDoc(
                file,
                activeScope,
                activeScope === "session" ? chat.sessionId : ""
            );
            onDocUploaded({
                doc_id: result.doc_id,
                filename: result.filename,
                chunks: result.chunks,
                scope: activeScope,
            });
            setUploadResult({
                type: "success",
                message: `"${result.filename}" indexed (${result.chunks} chunks, Starter tier)`,
            });
        } catch (err) {
            setUploadResult({
                type: "error",
                message: err instanceof Error ? err.message : "Upload failed",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    if (!ui.isUploadModalOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && ui.closeUploadModal()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden dark:border-white/[0.08] dark:bg-zinc-900/90 dark:shadow-black/50">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.06]">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Upload Document</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
                            Indexed for Starter tier immediately. Higher tiers index on first query.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={ui.closeUploadModal}
                        className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-200"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Scope tabs */}
                <div className="flex border-b border-slate-200 dark:border-white/[0.06]">
                    <button
                        onClick={() => { ui.openUploadModal("global"); setUploadResult(null); }}
                        className={`
                            flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-all
                            ${activeScope === "global"
                                ? "text-cyan-300 border-b-2 border-cyan-500"
                                : "text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300"
                            }
                        `}
                    >
                        <Globe className="h-3.5 w-3.5" />
                        Global Docs
                        <span className="ml-1 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                            {globalDocs.length}
                        </span>
                    </button>
                    <button
                        onClick={() => { ui.openUploadModal("session"); setUploadResult(null); }}
                        className={`
                            flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-all
                            ${activeScope === "session"
                                ? "text-cyan-300 border-b-2 border-cyan-500"
                                : "text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300"
                            }
                        `}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        This Chat
                        <span className="ml-1 text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-full dark:bg-white/10">
                            {sessionDocs.length}
                        </span>
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Scope description */}
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                        {activeScope === "global"
                            ? "Global docs are available to all chat sessions. Good for reference material."
                            : "This Chat docs are only available in the current session. They won't appear in other chats."}
                    </p>

                    {/* Drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`
                            relative flex flex-col items-center justify-center gap-3
                            rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer
                            transition-all duration-200
                            ${dragging
                                ? "border-cyan-500/70 bg-cyan-500/10"
                                : "border-slate-300 hover:border-cyan-500/40 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/[0.02]"
                            }
                            ${uploading ? "pointer-events-none opacity-70" : ""}
                        `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".txt,.md,.csv,.json,.pdf,.docx,.doc"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFile(file);
                                e.target.value = "";
                            }}
                        />

                        {uploading ? (
                            <Loader2 className="h-8 w-8 text-cyan-300 animate-spin" />
                        ) : (
                            <Upload className={`h-8 w-8 transition-colors ${dragging ? "text-cyan-300" : "text-zinc-600"}`} />
                        )}

                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                                {uploading ? "Uploading..." : "Drag & drop or click to upload"}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-600 mt-0.5">
                                PDF, DOCX, TXT, MD, CSV, JSON · max 10 MB
                            </p>
                        </div>
                    </div>

                    {/* Upload result */}
                    {uploadResult && (
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${uploadResult.type === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                            {uploadResult.type === "success"
                                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            }
                            <span>{uploadResult.message}</span>
                        </div>
                    )}

                    {/* Uploaded docs list */}
                    {docs.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-zinc-600 font-medium">
                                Indexed documents
                            </p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {docs.map((doc) => (
                                    <div
                                        key={doc.doc_id}
                                        className="flex items-center gap-2 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 dark:bg-white/[0.03] dark:border-white/[0.05]"
                                    >
                                        <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-500 flex-shrink-0" />
                                        <span className="text-xs text-slate-700 dark:text-zinc-300 flex-1 truncate">
                                            {doc.filename}
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-zinc-600 flex-shrink-0">
                                            {doc.chunks} chunks
                                        </span>
                                        <button
                                            onClick={() => onDocRemoved(doc.doc_id)}
                                            className="flex-shrink-0 text-slate-500 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
