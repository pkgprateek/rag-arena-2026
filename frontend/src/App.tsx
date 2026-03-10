import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
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
import { Sun, Moon } from "lucide-react";
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
  const [isMainAreaDragging, setIsMainAreaDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
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
      setGlobalDocs((prev) => [
        ...prev.filter((d) => d.doc_id !== doc.doc_id),
        doc,
      ]);
      return;
    }
    setSessionDocs((prev) => [
      ...prev.filter((d) => d.doc_id !== doc.doc_id),
      doc,
    ]);
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
    chat.reset(tier);
    compare.reset();
    setSessionDocs([]);
    // Force navigation to home
    if (location.pathname !== "/") {
      navigate("/");
    }
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

  const handleMainAreaDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (ui.isUploadModalOpen) return;
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsMainAreaDragging(true);
    }
  };

  const handleMainAreaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (ui.isUploadModalOpen) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsMainAreaDragging(false);
    }
  };

  const handleMainAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleMainAreaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsMainAreaDragging(false);

    if (ui.isUploadModalOpen) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setStagedFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
        const uniqueNew = newFiles.filter(
          (f) => !existingKeys.has(`${f.name}-${f.size}`),
        );
        return [...prev, ...uniqueNew];
      });
    }
  };

  const handleSendMessage = async (msg: string) => {
    if (stagedFiles.length > 0) {
      setIsSending(true);
      try {
        await Promise.all(
          stagedFiles.map(async (file) => {
            const result = await api.uploadDoc(file, "session", chat.sessionId);
            handleDocUploaded({
              doc_id: result.doc_id,
              filename: result.filename,
              chunks: result.chunks,
              scope: "session",
            });
          }),
        );
        setStagedFiles([]);
        // Wait, I should not clear isSending right away to avoid flicker
        // before chat.isStreaming takes over, but setting it false is fine because it will quickly be followed by message dispatch
        setIsSending(false);
      } catch (err) {
        console.error("Upload failed before sending message", err);
        alert("Failed to upload attached files. Message not sent.");
        setIsSending(false);
        return;
      }
    }
    chat.sendMessage(msg, chat.currentModel);
  };

  const totalDocs = globalDocs.length + sessionDocs.length;

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#F4EFE6] text-[#1A1A1A] font-sans dark:bg-[#121212] dark:text-zinc-100 relative selection:bg-orange-100 dark:selection:bg-orange-500/30">
        <Sidebar
          sessions={sidebarSessions}
          currentSessionId={chat.sessionId}
          onNewChatWithTier={handleNewChatWithTier}
          onNavigateHome={() => {
            chat.reset();
            navigate("/");
          }}
          onCompare={() => navigate("/compare")}
          onSelectSession={chat.loadSession}
          onDeleteSession={handleDeleteSession}
          onToggleDrawer={ui.toggleDrawer}
          totalDocs={totalDocs}
          onDocsClick={() => ui.setDocsDrawerOpen(!ui.isDocsDrawerOpen)}
          isComparePage={isComparePage}
        />

        <main
          className="flex-1 flex flex-col relative bg-transparent dark:bg-[#1A1A1A] min-h-0 overflow-hidden"
          onDragEnter={handleMainAreaDragEnter}
          onDragLeave={handleMainAreaDragLeave}
          onDragOver={handleMainAreaDragOver}
          onDrop={handleMainAreaDrop}
        >
          <header className="absolute top-0 w-full h-14 flex flex-row items-center justify-end px-6 z-10 font-sans pointer-events-auto">
            <div className="flex items-center gap-2 mt-2">
              {!isComparePage && (
                <div className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white/50 px-3 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-800/50 dark:text-zinc-300">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: TIERS[chat.currentTier].color }}
                  />
                  <span className="tracking-wide">
                    {TIERS[chat.currentTier].name}
                  </span>
                </div>
              )}
              <div
                className="relative flex h-9 items-center rounded-full border border-slate-200/60 bg-white/50 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-800/50"
              >
                <div
                  className="absolute left-1 top-1 bottom-1 w-7 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) dark:bg-zinc-700"
                  style={{ transform: ui.theme === "dark" ? "translateX(28px)" : "translateX(0)" }}
                />
                <button
                  onClick={() => ui.setTheme("light")}
                  className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-500 ${ui.theme === "light" ? "text-orange-500" : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"}`}
                  title="Light Mode"
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => ui.setTheme("dark")}
                  className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-500 ${ui.theme === "dark" ? "text-blue-400" : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"}`}
                  title="Dark Mode"
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    "https://cal.com/prateek-kumar-goyal/15min",
                    "_blank",
                  )
                }
                className="h-9 gap-1.5 px-6 min-w-[120px] text-xs font-medium rounded-full shadow-md transition-all border border-transparent bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <Video className="h-4 w-4" />
                <span>Book a call</span>
              </Button>
            </div>
          </header>

          {isComparePage ? (
            <CompareView
              tierResults={compare.tierResults}
              selectedTiers={compare.selectedTiers}
              onSelectedTiersChange={compare.setSelectedTiers}
              onRunCompare={handleSendMessage}
              isRunning={compare.isRunning || isSending}
              stagedFiles={stagedFiles}
              onAttach={() => ui.openUploadModal("session")}
              onRemoveStagedFile={(idx) =>
                setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
              }
              isDraggingOver={isMainAreaDragging}
            />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 pb-8 pt-16 flex flex-col items-center min-h-0">
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
                onSend={handleSendMessage}
                disabled={chat.isStreaming || isSending}
                onAttach={() => ui.openUploadModal("session")}
                centered={!chat.hasInteracted}
                models={chat.availableModels}
                currentModel={chat.currentModel}
                onModelChange={chat.setCurrentModel}
                isDraggingOver={isMainAreaDragging}
                stagedFiles={stagedFiles}
                onRemoveStagedFile={(idx) =>
                  setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
                }
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
    </TooltipProvider>
  );
}

export default App;
