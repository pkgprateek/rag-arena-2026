// RAG Arena 2026 — API client

import type {
    ChatSendRequest,
    ChatSendResponse,
    CompareRunRequest,
    CompareRunResponse,
    SessionSummary,
    Tier,
    TierProfile,
} from "@/types";
import { API_BASE } from "@/lib/constants";

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json() as Promise<TRes>;
}

export const api = {
    chatSend: (req: ChatSendRequest) =>
        post<ChatSendRequest, ChatSendResponse>("/chat/send", req),

    compareRun: (req: CompareRunRequest) =>
        post<CompareRunRequest, CompareRunResponse>("/compare/run", req),

    getRun: async (runId: string) => {
        const res = await fetch(`${API_BASE}/runs/${runId}`);
        if (!res.ok) throw new Error(`Run not found: ${runId}`);
        return res.json();
    },

    health: async () => {
        const res = await fetch(`${API_BASE}/health`);
        return res.json();
    },

    fetchSessions: async (): Promise<SessionSummary[]> => {
        const res = await fetch(`${API_BASE}/chat/sessions`);
        if (!res.ok) throw new Error("Failed to fetch sessions");
        return res.json();
    },

    fetchSessionMessages: async (
        sessionId: string
    ): Promise<{ messages: any[]; session_tier: string }> => {
        const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
    },

    deleteSession: async (sessionId: string): Promise<{ session_id: string; status: string }> => {
        const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
            method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete session");
        return res.json();
    },

    fetchModels: async (): Promise<{ models: string[]; default: string }> => {
        const res = await fetch(`${API_BASE}/models`);
        if (!res.ok) throw new Error("Failed to fetch models");
        return res.json();
    },

    fetchCalcomLink: async (): Promise<string> => {
        const res = await fetch(`${API_BASE}/config/calcom`);
        if (!res.ok) return "";
        const data = await res.json();
        return data.calcom_link || "";
    },

    fetchTierProfiles: async (): Promise<Record<Tier, TierProfile>> => {
        const res = await fetch(`${API_BASE}/config/tiers`);
        if (!res.ok) throw new Error("Failed to fetch tier profiles");
        const data = (await res.json()) as TierProfile[];
        return data.reduce(
            (acc, profile) => {
                acc[profile.id] = profile;
                return acc;
            },
            {} as Record<Tier, TierProfile>,
        );
    },

    listDocs: async (): Promise<{
        documents: { doc_id: string; filename: string; chunks: number }[];
        store_stats: { total_docs: number; total_chunks: number };
    }> => {
        const res = await fetch(`${API_BASE}/docs/list`);
        if (!res.ok) throw new Error("Failed to list documents");
        return res.json();
    },

    uploadDoc: async (
        file: File,
        scope: "global" | "session" = "global",
        session_id: string = ""
    ) => {
        const formData = new FormData();
        formData.append("file", file);
        const params = new URLSearchParams({ scope });
        if (scope === "session" && session_id) params.set("session_id", session_id);
        const res = await fetch(`${API_BASE}/docs/upload?${params}`, {
            method: "POST",
            body: formData,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "Upload failed");
            throw new Error(`Upload failed: ${text}`);
        }
        return res.json();
    },
};
