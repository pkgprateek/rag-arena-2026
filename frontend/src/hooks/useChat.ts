// RAG Arena 2026 — Chat hook

import { useState, useCallback, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSSE } from "@/hooks/useSSE";
import { api } from "@/lib/api";
import type { Message, StreamEvent, Metrics, EvalResult, Tier } from "@/types";

export function useChat() {
  const store = useChatStore();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    api
      .fetchModels()
      .then((res) => {
        store.setAvailableModels(res.models);
        if (res.default && !store.currentModel) {
          store.setCurrentModel(res.default);
        }
      })
      .catch((err) => console.error("Failed to fetch models:", err));
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvent = useCallback(
    (event: StreamEvent) => {
      switch (event.event) {
        case "token":
          store.appendToLastMessage(event.data as string);
          break;
        case "metrics":
          store.updateLastMessageMetrics(event.data as unknown as Metrics);
          break;
        case "eval_result":
          store.updateLastMessageEval(event.data as unknown as EvalResult);
          break;
        case "done":
          store.markLastMessageDone();
          store.setStreaming(false);
          setStreamUrl(null);
          break;
        case "error":
          store.appendToLastMessage(
            `\n\n⚠️ Error: ${typeof event.data === "string" ? event.data : JSON.stringify(event.data)}`
          );
          store.markLastMessageDone();
          store.setStreaming(false);
          setStreamUrl(null);
          break;
      }
    },
    [store]
  );

  useSSE({
    url: streamUrl,
    onEvent: handleEvent,
    onError: () => {
      store.setStreaming(false);
      setStreamUrl(null);
    },
  });

  const sendMessage = useCallback(
    async (content: string, modelOverride?: string) => {
      if (!content.trim() || store.isStreaming) return;

      // Per-prompt model selection: use override if provided, fall back to store default
      const model = modelOverride || store.currentModel;
      if (!model) {
        alert("No model selected. Add one in Settings.");
        return;
      }

      // User message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        tier: store.currentTier,
        model,
        citations: [],
      };
      store.addMessage(userMsg);

      // Placeholder assistant message
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        tier: store.currentTier,
        model,
        citations: [],
        isStreaming: true,
      };
      store.addMessage(assistantMsg);
      store.setStreaming(true);

      try {
        const res = await api.chatSend({
          session_id: store.sessionId,
          message: content,
          tier: store.currentTier,
          model,
        });
        setStreamUrl(res.stream_url);
      } catch (err) {
        store.appendToLastMessage(
          `\n\n⚠️ Failed to send: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        store.markLastMessageDone();
        store.setStreaming(false);
      }
    },
    [store]
  );

  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const data = await api.fetchSessionMessages(sessionId);
        const tier = (data.session_tier || "starter") as Tier;
        store.setSessionId(sessionId, tier);
        store.setMessages(
          (data.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            tier: m.tier || "starter",
            model: m.model || store.currentModel,
            citations: m.citations || [],
            isStreaming: false,
          }))
        );
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    },
    [store]
  );

  const startNewSession = useCallback(
    (tier?: Tier) => {
      store.reset(tier);
    },
    [store]
  );

  const requestTierChange = useCallback(
    (nextTier: Tier) => {
      if (nextTier === store.currentTier) return;

      if (store.messages.length > 0 || store.hasInteracted) {
        const shouldStartNew = window.confirm(
          `Tier is locked per session. Start a new ${nextTier.toUpperCase()} chat session?`
        );
        if (!shouldStartNew) {
          return;
        }
        store.reset(nextTier);
        return;
      }

      store.setCurrentTier(nextTier);
    },
    [store]
  );

  return {
    messages: store.messages,
    isStreaming: store.isStreaming,
    currentTier: store.currentTier,
    currentModel: store.currentModel,
    availableModels: store.availableModels,
    hasInteracted: store.hasInteracted,
    isHydrated: store.isHydrated,
    sessionId: store.sessionId,
    sendMessage,
    loadSession,
    startNewSession,
    requestTierChange,
    setCurrentModel: store.setCurrentModel,
    reset: store.reset,
  };
}
