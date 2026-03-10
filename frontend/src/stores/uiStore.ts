// RAG Arena 2026 — UI state (Zustand)

import { create } from "zustand";

interface UIState {
    isDrawerOpen: boolean;
    isDocsDrawerOpen: boolean;
    isSidebarCollapsed: boolean;
    isUploadModalOpen: boolean;
    uploadModalScope: "global" | "session";
    theme: "dark" | "light";

    toggleDrawer: () => void;
    setDrawerOpen: (v: boolean) => void;
    setDocsDrawerOpen: (v: boolean) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (v: boolean) => void;
    openUploadModal: (scope?: "global" | "session") => void;
    closeUploadModal: () => void;
    setTheme: (t: "dark" | "light") => void;
}

export const useUIStore = create<UIState>((set) => ({
    isDrawerOpen: false,
    isDocsDrawerOpen: false,
    isSidebarCollapsed: false,
    isUploadModalOpen: false,
    uploadModalScope: "global",
    theme: "dark",

    toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),
    setDrawerOpen: (v) => set({ isDrawerOpen: v }),
    setDocsDrawerOpen: (v) => set({ isDocsDrawerOpen: v }),
    toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
    setSidebarCollapsed: (v) => set({ isSidebarCollapsed: v }),
    openUploadModal: (scope = "global") =>
        set({ isUploadModalOpen: true, uploadModalScope: scope }),
    closeUploadModal: () => set({ isUploadModalOpen: false }),
    setTheme: (t) => set({ theme: t }),
}));
