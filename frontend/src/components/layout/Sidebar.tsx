// RAG Arena 2026 — Collapsible Left Sidebar

import {
    PanelLeftClose,
    PanelLeftOpen,
    Sparkles,
    SquarePen,
    GitCompareArrows,
    Upload,
    History,
    BarChart3,
    Sun,
    Moon,
    Trash2,
    ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    currentTier,
    onTierChange,
    onNewChatWithTier,
    onCompare,
    onSelectSession,
    onDeleteSession,
    onToggleDrawer,
}: SidebarProps) {
    const ui = useUIStore();

    return (
        <aside
            className={`
                flex flex-col flex-shrink-0 h-screen border-r border-[#e5ddd2]
                bg-[#f3eee8] backdrop-blur-xl transition-[width] duration-300 ease-in-out overflow-hidden
                dark:border-white/[0.06] dark:bg-[#17181c]
                ${ui.isSidebarCollapsed ? "w-[64px]" : "w-[284px]"}
            `}
        >
            <div
                className={`border-b border-[#e5ddd2] dark:border-white/[0.06] flex-shrink-0 ${
                    ui.isSidebarCollapsed
                        ? "h-16 px-2 py-2 flex flex-col items-center justify-center gap-1"
                        : "h-14 px-3 flex items-center gap-2"
                }`}
            >
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                {!ui.isSidebarCollapsed && (
                    <span className="font-semibold text-sm tracking-tight text-[#3f3b37] truncate dark:text-zinc-100">
                        RAG Arena
                    </span>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={ui.toggleSidebar}
                            className={`h-7 w-7 text-[#7f776e] hover:text-[#433f3b] dark:text-zinc-500 dark:hover:text-zinc-200 ${
                                ui.isSidebarCollapsed ? "" : "ml-auto"
                            }`}
                        >
                            {ui.isSidebarCollapsed ? (
                                <PanelLeftOpen className="h-4 w-4" />
                            ) : (
                                <PanelLeftClose className="h-4 w-4" />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        {ui.isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    </TooltipContent>
                </Tooltip>
            </div>

            <div className={`flex flex-col gap-1 p-3 flex-shrink-0 ${ui.isSidebarCollapsed ? "items-center" : ""}`}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            title="Start a new chat"
                            className={`
                                h-9 text-sm font-medium text-[#403b36] hover:text-[#2d2a27]
                                bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/25
                                dark:text-zinc-100 dark:hover:text-white
                                transition-all ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-between gap-2 px-3"}
                            `}
                        >
                            <span className="inline-flex items-center gap-2">
                                <SquarePen className="h-4 w-4 flex-shrink-0" />
                                {!ui.isSidebarCollapsed && <span>New Chat</span>}
                            </span>
                            {!ui.isSidebarCollapsed && <ChevronDown className="h-3.5 w-3.5 text-[#7f776e] dark:text-zinc-400" />}
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
                            onClick={() => ui.openUploadModal("global")}
                            className={`
                                h-9 text-sm font-medium text-[#6f675e] hover:text-[#322f2b]
                                hover:bg-[#e8e0d6] transition-all dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
                                ${ui.isSidebarCollapsed ? "w-9 p-0 justify-center" : "w-full justify-start gap-2 px-3"}
                            `}
                        >
                            <Upload className="h-4 w-4 flex-shrink-0" />
                            {!ui.isSidebarCollapsed && <span>Upload Global Docs</span>}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Upload docs for all chats</TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            onClick={onCompare}
                            className={`
                                h-9 text-sm font-medium text-[#6f675e] hover:text-[#322f2b]
                                hover:bg-[#e8e0d6] transition-all dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5
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

            {!ui.isSidebarCollapsed && (
                <div className="px-3 pb-3 border-b border-[#e5ddd2] dark:border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-widest text-[#7b746b] dark:text-zinc-600 font-medium mb-1.5">
                        Session Tier
                    </p>
                    <Select value={currentTier} onValueChange={(value) => onTierChange(value as Tier)}>
                        <SelectTrigger className="h-8 bg-[#fcfaf6] border-[#d8cec2] text-xs dark:bg-zinc-900/70 dark:border-white/[0.08]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#fcfaf6] border-[#d8cec2] dark:bg-zinc-900 dark:border-white/[0.08]">
                            {TIER_ORDER.map((tier) => (
                                <SelectItem key={tier} value={tier} className="text-xs">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIERS[tier].color }} />
                                        {TIERS[tier].name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-[#7b746b] dark:text-zinc-500 mt-1.5 leading-relaxed">
                        {TIERS[currentTier].description}
                    </p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
                {!ui.isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 px-1 mb-2">
                        <History className="h-3 w-3 text-[#7b746b] dark:text-zinc-600" />
                        <span className="text-[10px] uppercase tracking-widest text-[#7b746b] dark:text-zinc-600 font-medium">
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
                                        ? "bg-[#e7dfd4] text-[#2f2b27] dark:bg-white/10 dark:text-zinc-100"
                                        : "text-[#6f675e] hover:text-[#322f2b] hover:bg-[#e8e0d6] dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5"}
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
                                                <span className="inline-flex items-center rounded border border-[#d8cec2] px-1 py-0 text-[9px] uppercase tracking-wide text-[#7b746b] dark:border-white/10 dark:text-zinc-500">
                                                    {session.tier}
                                                </span>
                                            </div>
                                            <span className="text-[#7b746b] dark:text-zinc-600 flex-shrink-0 text-[10px]">{session.timestamp}</span>
                                        </button>
                                        <button
                                            onClick={() => onDeleteSession(session.id)}
                                            className="rounded p-1 text-[#7b746b] hover:text-rose-700 hover:bg-rose-100 dark:text-zinc-600 dark:hover:text-rose-300 dark:hover:bg-rose-500/15"
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
                    <p className="text-[#7b746b] dark:text-zinc-600 text-[11px] px-2 pt-1">No sessions yet</p>
                )}
            </div>

            <div className={`p-3 border-t border-[#e5ddd2] dark:border-white/[0.06] flex-shrink-0 ${ui.isSidebarCollapsed ? "flex flex-col items-center gap-1" : "space-y-1"}`}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            onClick={onToggleDrawer}
                            className={`
                                h-9 text-xs transition-all
                                text-[#6f675e] hover:text-[#322f2b] hover:bg-[#e8e0d6]
                                dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5
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
                                text-[#6f675e] hover:text-[#322f2b] hover:bg-[#e8e0d6]
                                dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/5
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
    );
}
