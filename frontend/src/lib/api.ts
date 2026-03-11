// RAG Arena 2026 — API client

import type {
    ChatSendRequest,
    ChatSendResponse,
    CompareRunRequest,
    CompareRunResponse,
    CreateRuntimeModelRequest,
    DocsListResponse,
    DocUploadResponse,
    RuntimeAppSettings,
    RuntimeModelConfig,
    SessionMessagePayload,
    SessionSummary,
    SettingsModelsResponse,
    Tier,
    TierProfile,
    UpdateRuntimeAppSettingsRequest,
    UpdateRuntimeModelRequest,
} from "@/types";
import { API_BASE } from "@/lib/constants";

async function fetchOrThrow(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    networkErrorMessage: string,
): Promise<Response> {
    try {
        return await fetch(input, init);
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(networkErrorMessage);
        }
        throw error;
    }
}

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const res = await fetchOrThrow(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }, "Could not reach the backend API.");
    if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json() as Promise<TRes>;
}

function withAdminHeaders(adminToken?: string): HeadersInit | undefined {
    if (!adminToken) {
        return undefined;
    }
    return { "X-Admin-Token": adminToken };
}

export const api = {
    chatSend: (req: ChatSendRequest) =>
        post<ChatSendRequest, ChatSendResponse>("/chat/send", req),

    compareRun: (req: CompareRunRequest) =>
        post<CompareRunRequest, CompareRunResponse>("/compare/run", req),

    getRun: async (runId: string) => {
        const res = await fetchOrThrow(
            `${API_BASE}/runs/${runId}`,
            undefined,
            "Could not reach the backend API.",
        );
        if (!res.ok) throw new Error(`Run not found: ${runId}`);
        return res.json();
    },

    health: async () => {
        const res = await fetchOrThrow(
            `${API_BASE}/health`,
            undefined,
            "Could not reach the backend API.",
        );
        return res.json();
    },

    fetchSessions: async (): Promise<SessionSummary[]> => {
        const res = await fetchOrThrow(
            `${API_BASE}/chat/sessions`,
            undefined,
            "Could not load sessions because the backend is unreachable.",
        );
        if (!res.ok) throw new Error("Failed to fetch sessions");
        return res.json();
    },

    fetchSessionMessages: async (
        sessionId: string
    ): Promise<{ messages: SessionMessagePayload[]; session_tier: string }> => {
        const res = await fetchOrThrow(
            `${API_BASE}/chat/sessions/${sessionId}`,
            undefined,
            "Could not load session messages because the backend is unreachable.",
        );
        if (!res.ok) throw new Error("Failed to fetch messages");
        return res.json();
    },

    deleteSession: async (sessionId: string): Promise<{ session_id: string; status: string }> => {
        const res = await fetchOrThrow(`${API_BASE}/chat/sessions/${sessionId}`, {
            method: "DELETE",
        }, "Could not delete the session because the backend is unreachable.");
        if (!res.ok) throw new Error("Failed to delete session");
        return res.json();
    },

    fetchModels: async (): Promise<{ models: string[]; default: string }> => {
        const res = await fetchOrThrow(
            `${API_BASE}/models`,
            undefined,
            "Could not load models from the backend API.",
        );
        if (!res.ok) throw new Error("Failed to fetch models");
        return res.json();
    },

    fetchCalcomLink: async (): Promise<string> => {
        const res = await fetchOrThrow(
            `${API_BASE}/config/calcom`,
            undefined,
            "Could not load the booking link because the backend is unreachable.",
        );
        if (!res.ok) return "";
        const data = await res.json();
        return data.calcom_link || "";
    },

    fetchTierProfiles: async (): Promise<Record<Tier, TierProfile>> => {
        const res = await fetchOrThrow(
            `${API_BASE}/config/tiers`,
            undefined,
            "Could not load tier profiles because the backend is unreachable.",
        );
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

    listDocs: async (sessionId: string): Promise<DocsListResponse> => {
        const params = new URLSearchParams();
        if (sessionId) {
            params.set("session_id", sessionId);
        }
        const query = params.toString();
        const res = await fetchOrThrow(
            `${API_BASE}/docs/list${query ? `?${query}` : ""}`,
            undefined,
            "Could not load documents because the backend is unreachable.",
        );
        if (!res.ok) throw new Error("Failed to list documents");
        return res.json();
    },

    uploadDoc: async (
        file: File,
        scope: "global" | "session" = "global",
        session_id: string = "",
        active_tier: Tier = "starter",
    ): Promise<DocUploadResponse> => {
        const formData = new FormData();
        formData.append("file", file);
        const params = new URLSearchParams({ scope, active_tier });
        if (scope === "session" && session_id) params.set("session_id", session_id);
        const res = await fetchOrThrow(`${API_BASE}/docs/upload?${params}`, {
            method: "POST",
            body: formData,
        }, "Could not upload documents because the backend API is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Upload failed");
            throw new Error(`Upload failed: ${text}`);
        }
        return res.json();
    },

    deleteDoc: async (docId: string): Promise<{ doc_id: string; status: string }> => {
        const res = await fetchOrThrow(`${API_BASE}/docs/${docId}`, {
            method: "DELETE",
        }, "Could not delete the document because the backend is unreachable.");
        if (!res.ok) throw new Error("Failed to delete document");
        return res.json();
    },

    fetchRuntimeModels: async (adminToken?: string): Promise<SettingsModelsResponse> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/models`, {
            headers: withAdminHeaders(adminToken),
        }, "Could not load runtime model settings because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to fetch settings models");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    fetchRuntimeAppSettings: async (adminToken?: string): Promise<RuntimeAppSettings> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/app`, {
            headers: withAdminHeaders(adminToken),
        }, "Could not load app settings because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to fetch app settings");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    updateRuntimeAppSettings: async (
        request: UpdateRuntimeAppSettingsRequest,
        adminToken?: string,
    ): Promise<RuntimeAppSettings> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/app`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(withAdminHeaders(adminToken) || {}),
            },
            body: JSON.stringify(request),
        }, "Could not update app settings because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to update app settings");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    createRuntimeModel: async (
        request: CreateRuntimeModelRequest,
        adminToken?: string,
    ): Promise<RuntimeModelConfig> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/models`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(withAdminHeaders(adminToken) || {}),
            },
            body: JSON.stringify(request),
        }, "Could not create the runtime model because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to create model");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    updateRuntimeModel: async (
        modelId: string,
        request: UpdateRuntimeModelRequest,
        adminToken?: string,
    ): Promise<RuntimeModelConfig> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/models/${modelId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(withAdminHeaders(adminToken) || {}),
            },
            body: JSON.stringify(request),
        }, "Could not update the runtime model because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to update model");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    deleteRuntimeModel: async (
        modelId: string,
        adminToken?: string,
    ): Promise<RuntimeModelConfig> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/models/${modelId}`, {
            method: "DELETE",
            headers: withAdminHeaders(adminToken),
        }, "Could not disable the runtime model because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to disable model");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },

    makeRuntimeModelDefault: async (
        modelId: string,
        adminToken?: string,
    ): Promise<RuntimeModelConfig> => {
        const res = await fetchOrThrow(`${API_BASE}/settings/models/${modelId}/make-default`, {
            method: "POST",
            headers: withAdminHeaders(adminToken),
        }, "Could not set the default runtime model because the backend is unreachable.");
        if (!res.ok) {
            const text = await res.text().catch(() => "Failed to set default model");
            throw new Error(`API ${res.status}: ${text}`);
        }
        return res.json();
    },
};
