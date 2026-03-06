// RAG Arena 2026 — Chat state (Zustand)

import { create } from "zustand";
import type { Message, Tier, Metrics, EvalResult } from "@/types";

interface ChatState {
    sessionId: string;
    messages: Message[];
    currentTier: Tier;
    currentModel: string;
    availableModels: string[];
    isStreaming: boolean;
    hasInteracted: boolean;

    setCurrentTier: (tier: Tier) => void;
    setCurrentModel: (model: string) => void;
    setAvailableModels: (models: string[]) => void;
    addMessage: (msg: Message) => void;
    appendToLastMessage: (token: string) => void;
    setStreaming: (v: boolean) => void;
    setHasInteracted: (v: boolean) => void;
    markLastMessageDone: () => void;
    updateLastMessageMetrics: (metrics: Metrics) => void;
    updateLastMessageEval: (evalResult: EvalResult) => void;
    setSessionId: (id: string, tier?: Tier) => void;
    setMessages: (msgs: Message[]) => void;
    reset: (tier?: Tier) => void;
}

function generateSessionId(): string {
    return crypto.randomUUID();
}

export const useChatStore = create<ChatState>((set) => ({
    sessionId: generateSessionId(),
    messages: [],
    currentTier: "starter",
    currentModel: "",
    availableModels: [],
    isStreaming: false,
    hasInteracted: false,

    setCurrentTier: (tier) => set({ currentTier: tier }),
    setCurrentModel: (model) => set({ currentModel: model }),
    setAvailableModels: (models) =>
        set((s) => ({
            availableModels: models,
            // Auto-select first model if none selected
            currentModel: s.currentModel || models[0] || "",
        })),

    addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg], hasInteracted: true })),

    appendToLastMessage: (token) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, content: last.content + token };
            }
            return { messages: msgs };
        }),

    setStreaming: (v) => set({ isStreaming: v }),
    setHasInteracted: (v) => set({ hasInteracted: v }),

    markLastMessageDone: () =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last) {
                msgs[msgs.length - 1] = { ...last, isStreaming: false };
            }
            return { messages: msgs };
        }),

    updateLastMessageMetrics: (metrics) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, metrics };
            }
            return { messages: msgs };
        }),

    updateLastMessageEval: (evalResult) =>
        set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, evalResult };
            }
            return { messages: msgs };
        }),

    setSessionId: (id, tier) =>
        set((s) => ({
            sessionId: id,
            hasInteracted: true,
            currentTier: tier ?? s.currentTier,
        })),
    setMessages: (msgs) => set({ messages: msgs, hasInteracted: msgs.length > 0 }),

    reset: (tier) =>
        set((s) => ({
            sessionId: generateSessionId(),
            messages: [],
            isStreaming: false,
            hasInteracted: false,
            currentTier: tier ?? s.currentTier,
            // Keep model selection across resets
            currentModel: s.currentModel,
            availableModels: s.availableModels,
        })),
}));
