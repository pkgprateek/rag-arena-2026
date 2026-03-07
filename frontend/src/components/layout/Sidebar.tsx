// RAG Arena 2026 — Collapsible Left Sidebar

import {
    PanelLeftClose,
    PanelLeftOpen,
    Sparkles,
    SquarePen,
    GitCompareArrows,
    History,
    BarChart3,
    Sun,
    Moon,
    Trash2,
    ChevronDown,
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
import { useUIStore } from "@/stores/uiStore";
import { TIERS, TIER_ORDER } from "@/lib/constants";
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
    currentTier: Tier;
    onTierChange: (tier: Tier) => void;
    onNewChatWithTier: (tier: Tier) => void;
    onCompare: () => void;
    onSelectSession: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onToggleDrawer: () => void;
}

export function Sidebar({
    sessions,
    currentSessionId,
    onNewChatWithTier,
    onCompare,
    onSelectSession,
    onDeleteSession,
    onToggleDrawer,
}: SidebarProps) {
    const ui = useUIStore();

    return (
        <div className="relative flex-shrink-0 h-screen transition-[width] duration-300 ease-in-out font-sans z-20" style={{ width: ui.isSidebarCollapsed ? "64px" : "260px" }}>
            <aside className="absolute inset-0 flex flex-col border-r border-[#EAEAEA] bg-white/50 backdrop-blur-xl dark:border-white/[0.04] dark:bg-[#1A1A1A]/50 overflow-hidden">
                <div
                    className={`border-b border-[#EAEAEA] dark:border-white/[0.04] flex-shrink-0 ${ui.isSidebarCollapsed
                        ? "h-14 px-2 py-2 flex flex-col items-center justify-center gap-1"
                        : "h-14 px-4 flex items-center gap-2"
                        }`}
                >
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    {!ui.isSidebarCollapsed && (
                        <span className="font-semibold text-[15px] tracking-tight text-slate-800 truncate dark:text-zinc-100">
                            RAG Arena
                        </span>
                    )}
                </div>

                <div className={`flex flex-col gap-1 p-3 flex-shrink-0 ${ui.isSidebarCollapsed ? "items-center" : ""}`}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                title="Start a new chat"
                                className={`
                                    h-9 text-sm font-medium text-[#403b36] hover:text-[#2d2a27]
                                    bg-orange-500/10 hover:bg-orange-500/20 border border-orange-400/20 text-orange-600
                                    dark:text-orange-400 dark:hover:text-orange-300
                                    transition-all ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-between gap-2 px-3"}
                                `}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <SquarePen className="h-4 w-4 flex-shrink-0" />
                                    {!ui.isSidebarCollapsed && <span>New Chat</span>}
                                </span>
                                {!ui.isSidebarCollapsed && <ChevronDown className="h-3.5 w-3.5 text-orange-600/60 dark:text-orange-400/60" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            {TIER_ORDER.map((tier) => (
                                <DropdownMenuItem
                                    key={tier}
                                    onClick={() => onNewChatWithTier(tier)}
                                    className="text-xs cursor-pointer"
                                >
                                    {TIERS[tier].name}
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
                                    h-9 text-sm font-medium text-slate-600 hover:text-slate-900
                                    hover:bg-slate-100 transition-all dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
                            >
                                <GitCompareArrows className="h-4 w-4 flex-shrink-0" />
                                {!ui.isSidebarCollapsed && <span>Compare Tiers</span>}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Run side-by-side compare</TooltipContent>
                    </Tooltip>
                </div>


                <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
                    {!ui.isSidebarCollapsed && (
                        <div className="flex items-center gap-1.5 px-1 mb-2 mt-2">
                            <History className="h-3 w-3 text-slate-400 dark:text-zinc-600" />
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-zinc-600 font-medium">
                                Recents
                            </span>
                        </div>
                    )}
                    {sessions.slice(0, 8).map((session) => (
                        <Tooltip key={session.id}>
                            <TooltipTrigger asChild>
                                <div
                                    className={`
                                        w-full rounded-md px-2 py-1.5 text-xs transition-all
                                        ${session.id === currentSessionId
                                            ? "bg-slate-200/50 text-slate-900 dark:bg-white/10 dark:text-zinc-100"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5"}
                                        ${ui.isSidebarCollapsed ? "text-center" : ""}
                                    `}
                                >
                                    {ui.isSidebarCollapsed ? (
                                        <button onClick={() => onSelectSession(session.id)} className="w-full">
                                            <span className="block truncate text-[10px]">{session.label.slice(0, 2)}</span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onSelectSession(session.id)} className="flex-1 min-w-0 text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate">{session.label}</span>
                                                    <span className="inline-flex items-center rounded border border-slate-200 bg-white px-1 py-0 text-[9px] uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400">
                                                        {session.tier}
                                                    </span>
                                                </div>
                                                <span className="text-slate-400 dark:text-zinc-600 flex-shrink-0 text-[10px]">{session.timestamp}</span>
                                            </button>
                                            <button
                                                onClick={() => onDeleteSession(session.id)}
                                                className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-600 dark:hover:text-rose-400 dark:hover:bg-rose-500/15 transition-colors opacity-0 group-hover:opacity-100"
                                                aria-label="Delete session"
                                                title="Delete session"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            {ui.isSidebarCollapsed && <TooltipContent side="right">{session.label}</TooltipContent>}
                        </Tooltip>
                    ))}
                    {sessions.length === 0 && !ui.isSidebarCollapsed && (
                        <p className="text-slate-400 dark:text-zinc-600 text-[11px] px-2 pt-1">No sessions yet</p>
                    )}
                </div>

                <div className={`p-3 border-t border-[#EAEAEA] dark:border-white/[0.04] flex-shrink-0 ${ui.isSidebarCollapsed ? "flex flex-col items-center gap-1" : "space-y-1"}`}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                onClick={onToggleDrawer}
                                className={`
                                    h-9 text-xs transition-all
                                    text-slate-600 hover:text-slate-900 hover:bg-slate-100
                                    dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
                            >
                                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                                {!ui.isSidebarCollapsed && <span>Metrics</span>}
                            </Button>
                        </TooltipTrigger>
                        {ui.isSidebarCollapsed && <TooltipContent side="right">View Metrics</TooltipContent>}
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                onClick={() => ui.setTheme(ui.theme === "dark" ? "light" : "dark")}
                                className={`
                                    h-9 text-xs transition-all
                                    text-slate-600 hover:text-slate-900 hover:bg-slate-100
                                    dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                    ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                                `}
                            >
                                {ui.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                {!ui.isSidebarCollapsed && <span>{ui.theme === "dark" ? "Light mode" : "Dark mode"}</span>}
                            </Button>
                        </TooltipTrigger>
                        {ui.isSidebarCollapsed && <TooltipContent side="right">Toggle Theme</TooltipContent>}
                    </Tooltip>
                </div>
            </aside>

            {/* Toggle Button placed strictly outside */}
            <div className="absolute top-1/2 -right-[14px] z-50">
                <button
                    onClick={ui.toggleSidebar}
                    className="h-7 w-7 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
                >
                    {ui.isSidebarCollapsed ? <PanelLeftOpen className="h-[14px] w-[14px]" /> : <PanelLeftClose className="h-[14px] w-[14px]" />}
                </button>
            </div>
        </div>
    );
}
