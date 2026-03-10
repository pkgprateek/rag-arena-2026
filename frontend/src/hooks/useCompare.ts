// RAG Arena 2026 — Compare hook

import { useState, useCallback } from "react";
import { useCompareStore } from "@/stores/compareStore";
import { useChatStore } from "@/stores/chatStore";
import { useSSE } from "@/hooks/useSSE";
import { api } from "@/lib/api";
import type { StreamEvent, Metrics, EvalResult, RunStatus, Tier } from "@/types";

export function useCompare() {
    const store = useCompareStore();
    const chatStore = useChatStore();
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [doneCount, setDoneCount] = useState(0);
    const [totalTiers, setTotalTiers] = useState(0);

    const handleEvent = useCallback(
        (event: StreamEvent) => {
            const runId = event.run_id;
            const currentState = useCompareStore.getState();
            if (!currentState.tierResults[runId] && event.tier) {
                currentState.initTierResult(event.tier as Tier, runId);
            }

            switch (event.event) {
                case "status":
                    store.updateTierStatus(runId, event.data as RunStatus);
                    break;
                case "token":
                    store.appendTierToken(runId, event.data as string);
                    break;
                case "metrics":
                    store.setTierMetrics(runId, event.data as unknown as Metrics);
                    break;
                case "eval_result":
                    store.setTierEval(runId, event.data as unknown as EvalResult);
                    break;
                case "done":
                    store.markTierDone(runId);
                    setDoneCount((c) => {
                        const next = c + 1;
                        if (next >= totalTiers) {
                            setStreamUrl(null);
                            store.setShowPostCompareCTA(true);
                        }
                        return next;
                    });
                    break;
                case "error":
                    store.updateTierStatus(runId, "error");
                    store.appendTierToken(
                        runId,
                        `\n\n⚠️ Error: ${typeof event.data === "string" ? event.data : JSON.stringify(event.data)}`
                    );
                    setDoneCount((c) => {
                        const next = c + 1;
                        if (next >= totalTiers) {
                            setStreamUrl(null);
                        }
                        return next;
                    });
                    break;
            }
        },
        [store, totalTiers]
    );

    useSSE({
        url: streamUrl,
        onEvent: handleEvent,
        onError: () => setStreamUrl(null),
    });

    const runCompare = useCallback(
        async (messageText: string) => {
            if (!messageText.trim()) return;

            const model = chatStore.currentModel;
            if (!model) {
                console.error("No model selected");
                return;
            }

            store.reset();
            store.setCompareMode(true);
            const tiersToCompare = store.selectedTiers;
            setDoneCount(0);
            setTotalTiers(tiersToCompare.length);

            try {
                const res = await api.compareRun({
                    session_id: chatStore.sessionId,
                    message_text: messageText,
                    tiers: tiersToCompare,
                    model,
                });

                store.setCompareRunId(res.compare_run_id);
                setStreamUrl(res.stream_url);
            } catch (err) {
                console.error("Compare run failed:", err);
            }
        },
        [store, chatStore.sessionId, chatStore.currentModel]
    );

    return {
        isCompareMode: store.isCompareMode,
        selectedTiers: store.selectedTiers,
        tierResults: store.tierResults,
        showPostCompareCTA: store.showPostCompareCTA,
        doneCount,
        isRunning: streamUrl !== null,
        setCompareMode: store.setCompareMode,
        setSelectedTiers: store.setSelectedTiers,
        runCompare,
        reset: store.reset,
    };
}
