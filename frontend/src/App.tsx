import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, UploadCloud, Loader2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { InsightsDrawer } from "@/components/layout/InsightsDrawer";
import { DocsDrawer } from "@/components/layout/DocsDrawer";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { CompareView } from "@/components/compare/CompareView";
import { useNavigate, useLocation } from "react-router-dom";
import { HeroSection } from "@/components/marketing/HeroSection";
import { PostCompareCTA } from "@/components/marketing/PostCompareCTA";
import { UploadModal } from "@/components/docs/UploadModal";
import { useChat } from "@/hooks/useChat";
import { useCompare } from "@/hooks/useCompare";
import { useUIStore } from "@/stores/uiStore";
import { TIERS } from "@/lib/constants";
import { api } from "@/lib/api";
import type { Tier } from "@/types";

interface UploadedDoc {
  doc_id: string;
  filename: string;
  chunks: number;
  scope: "global" | "session";
}

interface SessionListItem {
  id: string;
  label: string;
  timestamp: string;
  tier: Tier;
}

function App() {
  const chat = useChat();
  const compare = useCompare();
  const ui = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isComparePage = location.pathname === "/compare";

  const [globalDocs, setGlobalDocs] = useState<UploadedDoc[]>([]);
  const [sessionDocs, setSessionDocs] = useState<UploadedDoc[]>([]);
  const [dbSessions, setDbSessions] = useState<SessionListItem[]>([]);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [isUploadingDrop, setIsUploadingDrop] = useState(false);
  const dragCounter = React.useRef(0);

  React.useEffect(() => {
    api
      .fetchSessions()
      .then((data) => {
        const mapped = data.map((s) => ({
          id: s.id,
          label: `Chat ${s.id.substring(0, 6)}`,
          timestamp: new Date(s.created_at).toLocaleDateString(),
          tier: s.tier,
        }));
        setDbSessions(mapped);
      })
      .catch((err) => console.error("Failed to fetch sessions from DB:", err));
  }, [chat.sessionId, chat.hasInteracted]);

  React.useEffect(() => {
    const stored = localStorage.getItem("ui-theme");
    if (stored === "light" || stored === "dark") {
      ui.setTheme(stored);
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", ui.theme === "dark");
    localStorage.setItem("ui-theme", ui.theme);
  }, [ui.theme]);

  const sidebarSessions =
    chat.hasInteracted && !dbSessions.find((s) => s.id === chat.sessionId)
      ? [
        {
          id: chat.sessionId,
          label: "Current session",
          timestamp: "now",
          tier: chat.currentTier,
        },
        ...dbSessions,
      ]
      : dbSessions;

  const lastAssistant = [...chat.messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isStreaming);

  const handleDocUploaded = (doc: UploadedDoc) => {
    if (doc.scope === "global") {
      setGlobalDocs((prev) => [...prev.filter((d) => d.doc_id !== doc.doc_id), doc]);
      return;
    }
    setSessionDocs((prev) => [...prev.filter((d) => d.doc_id !== doc.doc_id), doc]);
  };

  const handleDocRemoved = async (docId: string) => {
    try {
      await fetch(`/api/docs/${docId}`, { method: "DELETE" });
      setGlobalDocs((prev) => prev.filter((d) => d.doc_id !== docId));
      setSessionDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    } catch (err) {
      console.error("Failed to remove doc:", err);
    }
  };

  const handleNewChat = () => {
    chat.startNewSession();
    compare.reset();
    setSessionDocs([]);
  };

  const handleNewChatWithTier = (tier: Tier) => {
    chat.startNewSession(tier);
    compare.reset();
    setSessionDocs([]);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const ok = window.confirm("Delete this chat session permanently?");
    if (!ok) return;

    try {
      await api.deleteSession(sessionId);
      setDbSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (chat.sessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Could not delete this session.");
    }
  };

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsGlobalDragging(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsGlobalDragging(false);
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsGlobalDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setIsUploadingDrop(true);
    try {
      const result = await api.uploadDoc(file, "session", chat.sessionId);
      handleDocUploaded({
        doc_id: result.doc_id,
        filename: result.filename,
        chunks: result.chunks,
        scope: "session",
      });
      ui.openUploadModal("session");
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document");
    } finally {
      setIsUploadingDrop(false);
    }
  };

  const totalDocs = globalDocs.length + sessionDocs.length;

  return (
    <TooltipProvider>
      <div
        className="flex h-screen w-full overflow-hidden bg-[#FAFAFA] text-[#1A1A1A] font-sans dark:bg-[#121212] dark:text-zinc-100 relative selection:bg-orange-100 dark:selection:bg-orange-500/30"
        onDragEnter={handleGlobalDragEnter}
        onDragLeave={handleGlobalDragLeave}
        onDragOver={handleGlobalDragOver}
        onDrop={handleGlobalDrop}
      >
        {isGlobalDragging && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-orange-500/10 backdrop-blur-sm border-2 border-orange-500 border-dashed rounded-xl m-4 transition-all">
            <div className="flex flex-col items-center bg-white/90 dark:bg-zinc-900/90 p-8 rounded-2xl shadow-2xl pointer-events-none">
              <UploadCloud className="h-12 w-12 text-orange-500 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Drop files to upload</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">Will be added to the current chat session</p>
            </div>
          </div>
        )}
        {isUploadingDrop && (
          <div className="absolute top-16 right-1/2 translate-x-1/2 z-[100] flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs font-medium">Uploading document...</span>
          </div>
        )}

        <Sidebar
          sessions={sidebarSessions}
          currentSessionId={chat.sessionId}
          currentTier={chat.currentTier}
          onTierChange={chat.requestTierChange}
          onNewChatWithTier={handleNewChatWithTier}
          onCompare={() => navigate("/compare")}
          onSelectSession={chat.loadSession}
          onDeleteSession={handleDeleteSession}
          onToggleDrawer={ui.toggleDrawer}
        />

        <main className="flex-1 flex flex-col relative bg-white dark:bg-[#1A1A1A]">
          <header className="absolute top-0 w-full h-14 flex flex-row items-center justify-end px-6 z-10 font-sans pointer-events-auto">
            <div className="flex items-center gap-3 h-full py-2 bg-white/50 backdrop-blur shadow-sm border border-slate-200 rounded-full pl-3 pr-2 mt-2 mr-2 dark:border-white/10 dark:bg-zinc-800/80">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-600 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TIERS[chat.currentTier].color }} />
                <span>{TIERS[chat.currentTier].name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => ui.setDocsDrawerOpen(!ui.isDocsDrawerOpen)}
                className="h-9 gap-1.5 px-3 text-xs font-medium bg-white/50 backdrop-blur shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-full dark:border-white/10 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <FileText className="h-4 w-4 text-orange-500" />
                <span>{totalDocs} Sources</span>
              </Button>
              <Button size="sm" className="h-9 bg-slate-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-slate-900 dark:hover:bg-zinc-200 rounded-full px-6 text-[13px] font-medium transition-all shadow-sm">
                Book a call
              </Button>
            </div>
          </header>

          {isComparePage ? (
            <CompareView
              tierResults={compare.tierResults}
              selectedTiers={compare.selectedTiers}
              onSelectedTiersChange={compare.setSelectedTiers}
              onRunCompare={compare.runCompare}
              isRunning={compare.isRunning}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 pb-32 pt-16 flex flex-col items-center">
                {!chat.hasInteracted ? (
                  <HeroSection
                    onAnalyze={() => ui.openUploadModal("session")}
                    onCompare={() => navigate("/compare")}
                  />
                ) : (
                  <div className="w-full max-w-[800px] mb-8">
                    <ChatContainer messages={chat.messages} />
                    {compare.showPostCompareCTA && (
                      <div className="flex-shrink-0 py-3">
                        <PostCompareCTA />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <MessageComposer
                onSend={(msg) => chat.sendMessage(msg, chat.currentModel)}
                disabled={chat.isStreaming}
                onAttach={() => ui.openUploadModal("session")}
                centered={!chat.hasInteracted}
                models={chat.availableModels}
                currentModel={chat.currentModel}
                onModelChange={chat.setCurrentModel}
              />
            </>
          )}
        </main>

        <InsightsDrawer
          open={ui.isDrawerOpen}
          onOpenChange={ui.setDrawerOpen}
          currentTier={chat.currentTier}
          metrics={lastAssistant?.metrics}
          evalResult={lastAssistant?.evalResult}
        />

        <DocsDrawer
          open={ui.isDocsDrawerOpen}
          onOpenChange={ui.setDocsDrawerOpen}
          globalDocs={globalDocs}
          sessionDocs={sessionDocs}
          onDocRemoved={handleDocRemoved}
        />

        <UploadModal
          globalDocs={globalDocs}
          sessionDocs={sessionDocs}
          onDocUploaded={handleDocUploaded}
          onDocRemoved={handleDocRemoved}
        />
      </div>
    </TooltipProvider >
  );
}

export default App;
