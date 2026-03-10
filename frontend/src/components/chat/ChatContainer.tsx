// RAG Arena 2026 — Chat Container

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Message } from "@/types";

interface ChatContainerProps {
    messages: Message[];
}

export function ChatContainer({ messages }: ChatContainerProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new messages / streaming tokens
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl divide-y divide-slate-200 dark:divide-white/[0.03]">
                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}
