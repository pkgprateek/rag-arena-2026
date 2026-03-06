// RAG Arena 2026 — SSE hook

import { useEffect, useRef, useCallback } from "react";
import type { StreamEvent } from "@/types";

interface UseSSEOptions {
    url: string | null;
    onEvent: (event: StreamEvent) => void;
    onError?: (err: Event) => void;
    onDone?: () => void;
}

/**
 * Generic SSE hook. Connects to the given URL, parses events, dispatches typed
 * callbacks. Auto-closes on unmount or when a "done"/"error" event arrives.
 */
export function useSSE({ url, onEvent, onError, onDone }: UseSSEOptions) {
    const esRef = useRef<EventSource | null>(null);
    const onEventRef = useRef(onEvent);
    const onErrorRef = useRef(onError);
    const onDoneRef = useRef(onDone);

    // Keep refs fresh without re-triggering the effect
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
    onDoneRef.current = onDone;

    const close = useCallback(() => {
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!url) return;

        const es = new EventSource(url);
        esRef.current = es;

        const handleMessage = (_type: string) => (ev: MessageEvent) => {
            try {
                const parsed: StreamEvent = JSON.parse(ev.data);
                onEventRef.current(parsed);

                if (parsed.event === "done" || parsed.event === "error") {
                    onDoneRef.current?.();
                    close();
                }
            } catch {
                // Non-JSON event, ignore
            }
        };

        // Listen to typed events + generic "message"
        const events = [
            "status",
            "token",
            "metrics",
            "citations",
            "eval_result",
            "done",
            "error",
        ];
        const handlers = events.map((t) => {
            const h = handleMessage(t);
            es.addEventListener(t, h as EventListener);
            return [t, h] as const;
        });

        // Also listen to the generic "message" event (fallback)
        const genericHandler = handleMessage("message");
        es.onmessage = genericHandler as EventListener;

        es.onerror = (err) => {
            onErrorRef.current?.(err);
            close();
        };

        return () => {
            handlers.forEach(([t, h]) =>
                es.removeEventListener(t, h as EventListener)
            );
            close();
        };
    }, [url, close]);

    return { close };
}
