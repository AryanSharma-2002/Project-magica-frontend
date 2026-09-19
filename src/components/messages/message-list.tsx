"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon } from "lucide-react";
import type { Message } from "@/contracts";
import type { LiveView } from "@/realtime/liveView";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { MessageBubble } from "./message-bubble";
import { StreamingStatus } from "./streaming-status";

export type MessageListProps = {
  /** Persisted messages, oldest -> newest. */
  messages: Message[];
  /** The id of the assistant message currently rendered from `live`, if any. */
  liveAssistantMessageId?: string | null;
  live?: LiveView | null;
  hasOlder?: boolean;
  isFetchingOlder?: boolean;
  fetchOlder?: () => void;
  onRetry?: (message: Message) => void;
  onOpenAsset: (url: string) => void;
  className?: string;
};

const BOTTOM_THRESHOLD_PX = 96;
const TOP_THRESHOLD_PX = 120;

/**
 * Virtualized message list: reverse infinite scroll (older messages load when scrolling near the
 * top, preserving scroll position), auto-follow the bottom while streaming only if the user is
 * already there, and a "Jump to latest" pill otherwise. `role="log"` + `aria-live="polite"` mark
 * the region as a live announcement area for streaming text.
 */
export function MessageList({
  messages,
  liveAssistantMessageId,
  live,
  hasOlder,
  isFetchingOlder,
  fetchOlder,
  onRetry,
  onOpenAsset,
  className,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevCountRef = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 8,
  });

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom < BOTTOM_THRESHOLD_PX);
    if (el.scrollTop < TOP_THRESHOLD_PX && hasOlder && !isFetchingOlder) {
      prevScrollHeightRef.current = el.scrollHeight;
      fetchOlder?.();
    }
  }, [hasOlder, isFetchingOlder, fetchOlder]);

  // Preserve the scroll anchor when older messages are prepended above the viewport.
  useLayoutEffect(() => {
    const el = parentRef.current;
    const grew = messages.length > prevCountRef.current;
    if (el && grew && prevScrollHeightRef.current != null) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-follow the bottom while streaming, but only if the user hasn't scrolled away.
  useEffect(() => {
    if (!isAtBottom) return;
    const el = parentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, live?.blocks.length, isAtBottom]);

  const scrollToBottom = () => {
    const el = parentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
  };

  const items = virtualizer.getVirtualItems();

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <div ref={parentRef} onScroll={handleScroll} role="log" aria-live="polite" aria-relevant="additions text" className="h-full overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {items.map((virtualRow) => {
            const message = messages[virtualRow.index];
            if (!message) return null;
            const isLive = Boolean(liveAssistantMessageId) && message.id === liveAssistantMessageId && message.status !== "completed";
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
              >
                <MessageBubble message={message} live={isLive ? (live ?? null) : null} onRetry={onRetry} onOpenAsset={onOpenAsset} />
                {isLive && live ? <StreamingStatus live={live} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {!isAtBottom ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <Button size="sm" variant="secondary" className="shadow-md" onClick={scrollToBottom}>
            <ArrowDownIcon /> Jump to latest
          </Button>
        </div>
      ) : null}
    </div>
  );
}
