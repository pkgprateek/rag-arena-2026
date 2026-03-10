// RAG Arena 2026 — Document Upload Modal (Global & Session scope)

import { useRef, useState, useEffect } from "react";
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

    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isGlobal, setIsGlobal] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    // Sync initial checkbox state from uiStore when modal opens
    useEffect(() => {
        if (ui.isUploadModalOpen) {
            setIsGlobal(ui.uploadModalScope === "global");
        }
    }, [ui.isUploadModalOpen, ui.uploadModalScope]);

    const allDocs = [...globalDocs, ...sessionDocs];

    const handleClose = () => {
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setUploadResult(null);
        setIsGlobal(false);
        ui.closeUploadModal();
    };

    const handleFilesSelect = (files: FileList | File[]) => {
        setPendingFiles((prev) => {
            const newFiles = Array.from(files);
            // Deduplicate by name and size to prevent accidental double-adds
            const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
            const uniqueNew = newFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
            return [...prev, ...uniqueNew];
        });
        setUploadResult(null);
    };

    const handleRemovePending = (index: number) => {
        setPendingFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== index);
            if (newFiles.length === 0 && fileInputRef.current) {
                // Clear the input so the user can select the same file again
                fileInputRef.current.value = "";
            }
            return newFiles;
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) {
            handleFilesSelect(e.dataTransfer.files);
        }
    };

    const handleUploadClick = async () => {
        if (pendingFiles.length === 0 || uploading) return;
        setUploadResult(null);
        setUploading(true);

        const activeScope = isGlobal ? "global" : "session";
        let successCount = 0;
        let failCount = 0;

        try {
            await Promise.all(
                pendingFiles.map(async (file) => {
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
                        successCount++;
                    } catch {
                        failCount++;
                        throw new Error("Upload failed inside Promise.all");
                    }
                })
            ).catch(() => {
                // Ignore the throw, handled by counts
            });

            if (failCount === 0) {
                setUploadResult({
                    type: "success",
                    message: `Successfully indexed ${successCount} document${successCount !== 1 ? 's' : ''}.`,
                });
                setPendingFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else if (successCount > 0) {
                setUploadResult({
                    type: "error",
                    message: `Indexed ${successCount} documents, but failed to upload ${failCount}.`,
                });
                setPendingFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                setUploadResult({
                    type: "error",
                    message: `Failed to upload ${failCount} document${failCount !== 1 ? 's' : ''}.`,
                });
            }
        } finally {
            setUploading(false);
        }
    };

    if (!ui.isUploadModalOpen) return null;

    // Helper calculate total size
    const totalSizeMB = (pendingFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget ? handleClose() : undefined}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm transition-opacity" />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden dark:border-white/[0.08] dark:bg-zinc-900/90 dark:shadow-black/50 animate-in zoom-in-95 duration-200 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.06]">
                    <div>
                        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-zinc-50">Upload Documents</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            Indexed for Starter tier immediately. Higher tiers index on first query.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
                        onDrop={handleDrop}
                        onClick={() => {
                            // Only trigger picker natively if no files are pending
                            if (!uploading && pendingFiles.length === 0) fileInputRef.current?.click();
                        }}
                        className={`
                            relative flex flex-col items-center justify-center
                            rounded-xl border-2 transition-all duration-200 overflow-hidden
                            ${pendingFiles.length > 0 ? "h-auto border-solid py-4" : "min-h-[160px] py-8"}
                            ${pendingFiles.length > 0
                                ? "border-slate-200 bg-slate-50 dark:border-white/[0.05] dark:bg-zinc-800/50"
                                : dragging
                                    ? "border-orange-500/70 bg-orange-500/5 border-dashed cursor-copy"
                                    : "border-slate-300 hover:border-orange-500/40 hover:bg-slate-50 border-dashed cursor-pointer dark:border-white/10 dark:hover:bg-white/[0.02]"
                            }
                            ${uploading ? "pointer-events-none opacity-50" : ""}
                        `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            accept=".txt,.md,.csv,.json,.pdf,.docx,.doc"
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    handleFilesSelect(e.target.files);
                                }
                            }}
                        />

                        {pendingFiles.length > 0 ? (
                            <div className="flex flex-col w-full h-full max-h-[220px]">
                                {/* Scrollable Icons Grid */}
                                <div
                                    className="flex-1 overflow-y-auto w-full px-4 py-2 smooth-scroll"
                                    onClick={(e) => e.stopPropagation()} /* Prevent click on grid from opening file picker */
                                >
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {pendingFiles.map((file, i) => (
                                            <div
                                                key={`${file.name}-${i}`}
                                                className="group relative flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-white/10 shadow-sm hover:border-orange-500/30 hover:shadow-orange-500/10 transition-all text-center"
                                            >
                                                <div className="h-8 w-8 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <p className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-zinc-300 w-full truncate px-1" title={file.name}>
                                                    {file.name}
                                                </p>
                                                <p className="text-[9px] text-slate-400 dark:text-zinc-500">
                                                    {(file.size / 1024).toFixed(0)} KB
                                                </p>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemovePending(i);
                                                    }}
                                                    className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/20 dark:hover:text-red-400 shadow-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                                                    title="Remove File"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Fixed Footer Area */}
                                <div className="text-center w-full px-4 mt-3 flex-shrink-0">
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                                        {totalSizeMB} MB total ({pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}) · Drag & drop or use Add More below
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center">
                                <div className={`p-3 rounded-full mb-3 ${dragging ? "bg-orange-500/10 text-orange-400" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-zinc-400"}`}>
                                    <Upload className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                                    Drag & drop or click to select
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                                    PDF, DOCX, TXT, MD, CSV, JSON · max 10 MB
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Upload Controls */}
                    <div className="flex flex-col gap-3">
                        {/* Add More Files Button (only shown when files exist) */}
                        {pendingFiles.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full h-10 border-dashed border-2 border-slate-300 text-slate-600 hover:border-orange-500/40 hover:bg-slate-50 hover:text-orange-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-orange-500/40 dark:hover:text-orange-400 transition-all shadow-none"
                            >
                                <Upload className="h-4 w-4 mr-2 opacity-70" />
                                Add more files
                            </Button>
                        )}

                        {pendingFiles.length > 0 ? (
                            <label className="flex items-start gap-3 select-none cursor-pointer p-3 rounded-xl hover:bg-slate-50 focus-within:ring-2 focus-within:ring-orange-500/30 dark:hover:bg-white/[0.02] border border-transparent hover:border-slate-200 dark:hover:border-white/[0.05] transition-all">
                                <input
                                    type="checkbox"
                                    checked={isGlobal}
                                    onChange={(e) => setIsGlobal(e.target.checked)}
                                    className="h-4 w-4 mt-0.5 bg-slate-50 rounded border-slate-300 text-orange-500 focus:ring-orange-500/30 dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-orange-500 dark:checked:border-orange-500 transition-colors"
                                    disabled={uploading}
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">Save as Global Document{pendingFiles.length > 1 ? 's' : ''}</span>
                                    <span className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">Global docs can be referenced across all your chats and sessions.</span>
                                </div>
                            </label>
                        ) : null}

                        <Button
                            onClick={handleUploadClick}
                            disabled={pendingFiles.length === 0 || uploading}
                            className={`w-full h-11 text-white transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${pendingFiles.length > 0 ? "bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white" : "bg-slate-300 dark:bg-white/10"}`}
                        >
                            {uploading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}...
                                </span>
                            ) : (
                                `Upload ${pendingFiles.length > 0 ? pendingFiles.length : ''} Document${pendingFiles.length !== 1 ? 's' : ''}`
                            )}
                        </Button>
                    </div>

                    {/* Upload result */}
                    {uploadResult ? (
                        <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs font-medium border shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-1 ${uploadResult.type === "success"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                            }`}>
                            {uploadResult.type === "success"
                                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            }
                            <span className="leading-snug">{uploadResult.message}</span>
                        </div>
                    ) : null}

                    {/* Uploaded docs list */}
                    {allDocs.length > 0 ? (
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold ml-1">
                                Indexed documents
                            </p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {allDocs.map((doc) => (
                                    <div
                                        key={doc.doc_id}
                                        className="group flex items-center gap-3 rounded-xl bg-slate-50/50 border border-slate-200/60 px-3.5 py-2.5 hover:bg-slate-50 hover:border-slate-300 transition-colors dark:bg-white/[0.01] dark:border-white/[0.04] dark:hover:bg-white/[0.02] dark:hover:border-white/[0.08]"
                                    >
                                        <div className={`p-1.5 rounded-md ${doc.scope === 'global' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'bg-slate-200/50 text-slate-500 dark:bg-white/5 dark:text-zinc-400'}`}>
                                            {doc.scope === 'global' ? (
                                                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                                            ) : (
                                                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">
                                                {doc.filename}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex-shrink-0">
                                                {doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''} • {doc.scope === 'global' ? 'Global' : 'This Chat'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onDocRemoved(doc.doc_id)}
                                            className="flex-shrink-0 ml-1 text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                                            title="Remove Document"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
