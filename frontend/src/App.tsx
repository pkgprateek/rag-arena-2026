import React, { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import { InsightsDrawer } from "@/components/layout/InsightsDrawer";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { CompareView } from "@/components/compare/CompareView";
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

  const [globalDocs, setGlobalDocs] = useState<UploadedDoc[]>([]);
  const [sessionDocs, setSessionDocs] = useState<UploadedDoc[]>([]);
  const [dbSessions, setDbSessions] = useState<SessionListItem[]>([]);

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

  const lastUserMessage =
    [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? "";

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

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-[#f7f5f2] text-[#3b3a39] dark:bg-[#202123] dark:text-zinc-100">
        <Sidebar
          sessions={sidebarSessions}
          currentSessionId={chat.sessionId}
          currentTier={chat.currentTier}
          onTierChange={chat.requestTierChange}
          onNewChatWithTier={handleNewChatWithTier}
          onCompare={() => compare.setCompareMode(!compare.isCompareMode)}
          onSelectSession={chat.loadSession}
          onDeleteSession={handleDeleteSession}
          onToggleDrawer={ui.toggleDrawer}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-[#e4ded6] bg-[#f7f5f2]/90 px-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#202123]/90">
            <span className="hidden text-xs text-[#7a756f] sm:block dark:text-zinc-500">
              {chat.hasInteracted
                ? `Session · ${chat.sessionId.slice(0, 8)}…`
                : "RAG Arena 2026"}
            </span>
            <div
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#e3dbd0] bg-[#fdfbf7] px-2.5 py-1 dark:border-white/[0.08] dark:bg-zinc-900/60"
              title={TIERS[chat.currentTier].description}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TIERS[chat.currentTier].color }}
              />
              <span className="text-[11px] font-medium text-[#6e6962] dark:text-zinc-300">
                Session tier
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: TIERS[chat.currentTier].color }}
              >
                {TIERS[chat.currentTier].name}
              </span>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {!chat.hasInteracted ? (
                <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto transition-all duration-300 ease-out">
                  <HeroSection />
                  <MessageComposer
                    onSend={chat.sendMessage}
                    disabled={chat.isStreaming}
                    onAttach={() => ui.openUploadModal("session")}
                    currentModel={chat.currentModel}
                    availableModels={chat.availableModels}
                    onModelChange={chat.setCurrentModel}
                    centered
                  />
                </div>
              ) : (
                <>
                  <ChatContainer messages={chat.messages} />

                  {compare.showPostCompareCTA && (
                    <div className="flex-shrink-0 px-4 py-3">
                      <PostCompareCTA />
                    </div>
                  )}

                  <MessageComposer
                    onSend={chat.sendMessage}
                    disabled={chat.isStreaming}
                    onAttach={() => ui.openUploadModal("session")}
                    currentModel={chat.currentModel}
                    availableModels={chat.availableModels}
                    onModelChange={chat.setCurrentModel}
                  />
                </>
              )}
            </div>

            {compare.isCompareMode && (
              <div className="absolute inset-0 z-50 flex flex-col bg-slate-100 dark:bg-[#202123]">
                <CompareView
                  tierResults={compare.tierResults}
                  selectedTiers={compare.selectedTiers}
                  onSelectedTiersChange={compare.setSelectedTiers}
                  onRunCompare={compare.runCompare}
                  isRunning={compare.isRunning}
                  lastUserMessage={lastUserMessage}
                  onClose={() => compare.setCompareMode(false)}
                />
              </div>
            )}
          </div>
        </div>

        <InsightsDrawer
          open={ui.isDrawerOpen}
          onOpenChange={ui.setDrawerOpen}
          currentTier={chat.currentTier}
          metrics={lastAssistant?.metrics}
          evalResult={lastAssistant?.evalResult}
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
