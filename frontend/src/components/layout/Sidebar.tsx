// RAG Arena 2026 — Collapsible Left Sidebar

import {
  PanelLeft,
  SquarePen,
  GitCompareArrows,
  BarChart3,
  Trash2,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTierCatalog } from "@/hooks/useTierCatalog";
import { useUIStore } from "@/stores/uiStore";
import type { Tier } from "@/types";

interface SidebarSession {
  id: string;
  label: string;
  timestamp: string;
  tier: Tier;
}

interface SidebarProps {
  sessions: SidebarSession[];
  currentSessionId: string;
  onNewChatWithTier: (tier: Tier) => void;
  onNavigateHome: () => void;
  onCompare: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleDrawer: () => void;
  totalDocs: number;
  onDocsClick: () => void;
  isComparePage?: boolean;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onNewChatWithTier,
  onNavigateHome,
  onCompare,
  onSelectSession,
  onDeleteSession,
  onToggleDrawer,
  totalDocs,
  onDocsClick,
  isComparePage,
}: SidebarProps) {
  const ui = useUIStore();
  const { tiers, tierOrder } = useTierCatalog();

  return (
    <div
      className="relative flex-shrink-0 h-screen transition-[width] duration-300 ease-in-out font-sans z-20"
      style={{ width: ui.isSidebarCollapsed ? "64px" : "240px" }}
    >
      <aside className="absolute inset-0 flex flex-col border-r border-[#EAEAEA] bg-white/50 backdrop-blur-xl dark:border-white/[0.04] dark:bg-[#1A1A1A]/50 overflow-hidden">
        <div className={`flex flex-col border-b border-[#EAEAEA] dark:border-white/[0.04] flex-shrink-0 transition-all ${ui.isSidebarCollapsed ? "py-4 gap-4 items-center" : "h-14 px-3 flex-row items-center justify-between"}`}>
          {ui.isSidebarCollapsed ? (
            <>
              <button
                onClick={ui.toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="h-5 w-5 stroke-[1.5]" />
              </button>
              <button
                onClick={onNavigateHome}
                className="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Go to home"
              >
                <div className="flex shrink-0 items-center justify-center p-0.5 transition-opacity hover:opacity-90">
                  <img src="/logo.svg" alt="Logo" className="h-6 w-auto" />
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-2.5 rounded-md pl-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
                title="Go to home"
              >
                <div className="flex shrink-0 items-center justify-center p-0.5">
                  <img src="/logo.svg" alt="Logo" className="h-6 w-auto" />
                </div>
                <span className="font-semibold text-[14px] tracking-tight text-slate-800 truncate dark:text-zinc-100">
                  RAG Arena
                </span>
              </button>
              <button
                onClick={ui.toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="h-5 w-5 stroke-[1.5]" />
              </button>
            </>
          )}
        </div>

        <div
          className={`flex flex-col gap-2 p-3 flex-shrink-0 ${ui.isSidebarCollapsed ? "items-center" : ""}`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                title="Start a new chat"
                className={`
                                    h-8 text-xs font-medium transition-all group
                                    text-slate-700 hover:text-slate-900 hover:bg-slate-100
                                    dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-8 p-0 justify-center" : "w-full justify-between gap-2 px-3"}
                                `}
              >
                <span className="inline-flex items-center gap-2">
                  <SquarePen className="h-4 w-4 flex-shrink-0 text-orange-500 dark:text-orange-400 transition-colors" />
                  {!ui.isSidebarCollapsed && <span>New Chat</span>}
                </span>
                {!ui.isSidebarCollapsed && (
                  <ChevronDown className="h-4 w-4 text-slate-400 dark:text-zinc-500 transition-colors" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/[0.08] dark:bg-zinc-900">
              {tierOrder.map((tier) => (
                <DropdownMenuItem
                  key={tier}
                  onClick={() => onNewChatWithTier(tier)}
                  className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: tiers[tier].color }}
                    />
                    {tiers[tier].name}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>



          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={onCompare}
                className={`
                                    h-8 text-xs font-medium transition-all
                                    ${isComparePage
                    ? "bg-slate-200/50 text-slate-900 shadow-sm dark:bg-white/10 dark:text-zinc-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5"
                  }
                                    ${ui.isSidebarCollapsed ? "w-8 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
              >
                <GitCompareArrows className="h-4 w-4 flex-shrink-0" />
                {!ui.isSidebarCollapsed && <span>Compare Tiers</span>}
              </Button>
            </TooltipTrigger>
            {ui.isSidebarCollapsed && (
              <TooltipContent side="right">Run side-by-side compare</TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={onDocsClick}
                className={`
                                    h-8 text-xs font-medium transition-all
                                    text-slate-600 hover:text-slate-900 hover:bg-slate-100
                                    dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-8 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                {!ui.isSidebarCollapsed && <span>{totalDocs} Sources</span>}
              </Button>
            </TooltipTrigger>
            {ui.isSidebarCollapsed && (
              <TooltipContent side="right">View Knowledge Base</TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={onToggleDrawer}
                className={`
                                    h-8 text-xs font-medium transition-all
                                    text-slate-600 hover:text-slate-900 hover:bg-slate-100
                                    dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-8 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                {!ui.isSidebarCollapsed && <span>Metrics</span>}
              </Button>
            </TooltipTrigger>
            {ui.isSidebarCollapsed && (
              <TooltipContent side="right">View Metrics</TooltipContent>
            )}
          </Tooltip>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 mt-3">
          {!ui.isSidebarCollapsed && (
            <div className="px-2 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">
                History
              </p>
            </div>
          )}
          {sessions.slice(0, 8).map((session) => (
            <Tooltip key={session.id}>
              <TooltipTrigger asChild>
                <div
                  className={`
                                        group
                                        w-full rounded-md px-2 py-1.5 text-xs transition-all
                                        ${session.id === currentSessionId
                      ? "bg-slate-200/50 text-slate-900 dark:bg-white/10 dark:text-zinc-100"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5"
                    }
                                        ${ui.isSidebarCollapsed ? "text-center" : ""}
                                    `}
                >
                  {ui.isSidebarCollapsed ? (
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="w-full"
                    >
                      <span className="block truncate text-[10px]">
                        {session.label.slice(0, 2)}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectSession(session.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate">{session.label}</span>
                          <span className="inline-flex items-center rounded border border-slate-200 bg-white px-1 h-4 text-[9px] leading-none uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400">
                            {session.tier}
                          </span>
                        </div>
                        <span className="text-slate-400 dark:text-zinc-600 flex-shrink-0 text-[10px]">
                          {session.timestamp}
                        </span>
                      </button>
                      <button
                        onClick={() => onDeleteSession(session.id)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-600 dark:hover:text-rose-400 dark:hover:bg-rose-500/15 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Delete session"
                        title="Delete session"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              {ui.isSidebarCollapsed && (
                <TooltipContent side="right">{session.label}</TooltipContent>
              )}
            </Tooltip>
          ))}
          {sessions.length === 0 && !ui.isSidebarCollapsed && (
            <p className="text-slate-400 dark:text-zinc-600 text-[11px] px-2 pt-1">
              No sessions yet
            </p>
          )}
        </div>
      </aside>


    </div>
  );
}
