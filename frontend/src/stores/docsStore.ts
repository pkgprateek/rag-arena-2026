import { create } from "zustand";

import { api } from "@/lib/api";
import type { DocListItem, PendingGlobalUpload, Tier } from "@/types";

interface DocsState {
  globalDocs: DocListItem[];
  sessionDocs: DocListItem[];
  pendingSessionAttachments: File[];
  pendingGlobalUploads: PendingGlobalUpload[];
  isDocsPolling: boolean;
  pollHandle: number | null;
  lastSessionId: string;
  refreshDocs: (sessionId: string) => Promise<void>;
  startPolling: (sessionId: string) => void;
  stopPolling: () => void;
  stageSessionFiles: (files: File[]) => void;
  removePendingSessionFile: (index: number) => void;
  clearPendingSessionFiles: () => void;
  flushPendingSessionFiles: (sessionId: string, activeTier: Tier) => Promise<void>;
  uploadGlobalFiles: (files: File[], activeTier: Tier) => Promise<void>;
  deleteDoc: (docId: string) => Promise<void>;
}

function splitDocs(documents: DocListItem[]) {
  return {
    globalDocs: documents.filter((doc) => doc.scope === "global"),
    sessionDocs: documents.filter((doc) => doc.scope === "session"),
  };
}

export const useDocsStore = create<DocsState>((set, get) => ({
  globalDocs: [],
  sessionDocs: [],
  pendingSessionAttachments: [],
  pendingGlobalUploads: [],
  isDocsPolling: false,
  pollHandle: null,
  lastSessionId: "",

  refreshDocs: async (sessionId: string) => {
    const response = await api.listDocs(sessionId);
    const next = splitDocs(response.documents);
    set({
      ...next,
      lastSessionId: sessionId,
    });
  },

  startPolling: (sessionId: string) => {
    const current = get().pollHandle;
    if (current !== null) {
      window.clearInterval(current);
    }
    const handle = window.setInterval(() => {
      void get().refreshDocs(sessionId);
    }, 5000);
    set({ isDocsPolling: true, pollHandle: handle, lastSessionId: sessionId });
  },

  stopPolling: () => {
    const handle = get().pollHandle;
    if (handle !== null) {
      window.clearInterval(handle);
    }
    set({ isDocsPolling: false, pollHandle: null });
  },

  stageSessionFiles: (files: File[]) =>
    set((state) => ({
      pendingSessionAttachments: [...state.pendingSessionAttachments, ...files],
    })),

  removePendingSessionFile: (index: number) =>
    set((state) => ({
      pendingSessionAttachments: state.pendingSessionAttachments.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    })),

  clearPendingSessionFiles: () => set({ pendingSessionAttachments: [] }),

  flushPendingSessionFiles: async (sessionId: string, activeTier: Tier) => {
    const files = [...get().pendingSessionAttachments];
    for (const file of files) {
      await api.uploadDoc(file, "session", sessionId, activeTier);
    }
    set({ pendingSessionAttachments: [] });
    await get().refreshDocs(sessionId);
  },

  uploadGlobalFiles: async (files: File[], activeTier: Tier) => {
    const pendingUploads = files.map((file) => ({
      id: crypto.randomUUID(),
      fileKey: `${file.name}-${file.lastModified}`,
      filename: file.name,
      status: "uploading" as const,
    }));
    set({ pendingGlobalUploads: pendingUploads });
    try {
      for (const file of files) {
        await api.uploadDoc(file, "global", "", activeTier);
      }
      set({ pendingGlobalUploads: [] });
      await get().refreshDocs(get().lastSessionId);
    } catch (error) {
      set({
        pendingGlobalUploads: pendingUploads.map((upload) => ({
          ...upload,
          status: "error" as const,
          errorText: error instanceof Error ? error.message : "Upload failed",
        })),
      });
      throw error;
    }
  },

  deleteDoc: async (docId: string) => {
    await api.deleteDoc(docId);
    await get().refreshDocs(get().lastSessionId);
  },
}));
