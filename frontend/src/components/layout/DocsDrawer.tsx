// RAG Arena 2026 — Docs Drawer

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Trash2, FileText, Globe, MessageSquare } from "lucide-react";

interface UploadedDoc {
    doc_id: string;
    filename: string;
    chunks: number;
    scope: "global" | "session";
}

interface DocsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    globalDocs: UploadedDoc[];
    sessionDocs: UploadedDoc[];
    onDocRemoved: (id: string) => void;
}

export function DocsDrawer({
    open,
    onOpenChange,
    globalDocs,
    sessionDocs,
    onDocRemoved,
}: DocsDrawerProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[340px] bg-slate-50 border-slate-200 p-0 overflow-y-auto dark:bg-[#202123] dark:border-white/[0.06] font-sans">
                <SheetHeader className="p-4 pb-0">
                    <SheetTitle className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                        Document Sources
                    </SheetTitle>
                </SheetHeader>

                <div className="p-4 space-y-6">
                    {/* Session Docs */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-orange-500" />
                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Session Documents</p>
                        </div>
                        {sessionDocs.length === 0 ? (
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">No documents uploaded to this session.</p>
                        ) : (
                            <div className="space-y-2">
                                {sessionDocs.map(doc => (
                                    <DocItem key={doc.doc_id} doc={doc} onRemove={() => onDocRemoved(doc.doc_id)} />
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator className="bg-slate-200 dark:bg-white/[0.06]" />

                    {/* Global Docs */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-sky-500" />
                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Global Knowledge Base</p>
                        </div>
                        {globalDocs.length === 0 ? (
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">No global documents available.</p>
                        ) : (
                            <div className="space-y-2">
                                {globalDocs.map(doc => (
                                    <DocItem key={doc.doc_id} doc={doc} onRemove={() => onDocRemoved(doc.doc_id)} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function DocItem({ doc, onRemove }: { doc: UploadedDoc; onRemove: () => void }) {
    return (
        <div className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm transition-all hover:border-orange-200 dark:bg-zinc-900/60 dark:border-white/[0.04] dark:hover:border-orange-500/30">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-3.5 w-3.5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate" title={doc.filename}>
                        {doc.filename}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {doc.chunks} chunks
                    </p>
                </div>
            </div>
            <button
                onClick={onRemove}
                className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Remove document"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
