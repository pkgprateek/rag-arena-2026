import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { FileText, Globe, Loader2, MessageSquare, Trash2 } from "lucide-react";

import type { DocListItem, Tier } from "@/types";

interface DocsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  globalDocs: DocListItem[];
  sessionDocs: DocListItem[];
  currentTier: Tier;
  onDocRemoved: (id: string) => void;
}

export function DocsDrawer({
  open,
  onOpenChange,
  globalDocs,
  sessionDocs,
  currentTier,
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
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Session Documents
              </p>
            </div>
            {sessionDocs.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">
                No documents uploaded to this session.
              </p>
            ) : (
              <div className="space-y-2">
                {sessionDocs.map((doc) => (
                  <DocItem
                    key={doc.doc_id}
                    currentTier={currentTier}
                    doc={doc}
                    onRemove={() => onDocRemoved(doc.doc_id)}
                  />
                ))}
              </div>
            )}
          </section>

          <Separator className="bg-slate-200 dark:bg-white/[0.06]" />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-500" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Global Knowledge Base
              </p>
            </div>
            {globalDocs.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 px-1">
                No global documents available.
              </p>
            ) : (
              <div className="space-y-2">
                {globalDocs.map((doc) => (
                  <DocItem
                    key={doc.doc_id}
                    currentTier={currentTier}
                    doc={doc}
                    onRemove={() => onDocRemoved(doc.doc_id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DocItem({
  doc,
  currentTier,
  onRemove,
}: {
  doc: DocListItem;
  currentTier: Tier;
  onRemove: () => void;
}) {
  const tierState = doc.tier_states[currentTier];
  const isProcessing =
    tierState.status === "queued" || tierState.status === "processing";
  const canDelete =
    doc.scope === "session" || !isProcessing;
  const chunkLabel =
    tierState.chunks > 0
      ? `${tierState.chunks} chunk${tierState.chunks === 1 ? "" : "s"}`
      : doc.scope === "session"
        ? "Attached to this session"
        : "Processing";

  return (
    <div
      className={`group flex items-center justify-between p-2.5 rounded-lg border shadow-sm transition-all ${
        isProcessing
          ? "bg-slate-100 border-slate-200 text-slate-400 dark:bg-zinc-900/40 dark:border-white/[0.04] dark:text-zinc-500"
          : "bg-white border-slate-200 hover:border-orange-200 dark:bg-zinc-900/60 dark:border-white/[0.04] dark:hover:border-orange-500/30"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`h-7 w-7 rounded flex items-center justify-center flex-shrink-0 ${
            isProcessing
              ? "bg-slate-200 dark:bg-white/5"
              : "bg-orange-50 dark:bg-orange-500/10"
          }`}
        >
          <FileText
            className={`h-3.5 w-3.5 ${
              isProcessing ? "text-slate-400 dark:text-zinc-500" : "text-orange-500"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-medium truncate ${
              isProcessing ? "text-slate-500 dark:text-zinc-400" : "text-slate-700 dark:text-zinc-300"
            }`}
            title={doc.filename}
          >
            {doc.filename}
          </p>
          <p className={`text-[10px] ${isProcessing ? "text-slate-400 dark:text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`}>
            {isProcessing
              ? `${capitalizeTier(currentTier)} processing`
              : `${formatTierState(currentTier, tierState.status)} · ${chunkLabel}`}
          </p>
        </div>
      </div>
      {canDelete ? (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          type="button"
          className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="Remove document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full bg-slate-200/80 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Processing</span>
        </div>
      )}
    </div>
  );
}

function formatTierState(tier: Tier, status: string) {
  return `${capitalizeTier(tier)} ${status}`;
}

function capitalizeTier(tier: Tier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
