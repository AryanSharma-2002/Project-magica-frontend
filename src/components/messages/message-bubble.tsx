"use client";
import { toast } from "sonner";
import { CopyIcon, RotateCcwIcon } from "lucide-react";
import { blocksToPlainText, type Message } from "@/contracts";
import type { LiveView } from "@/realtime/liveView";
import { BlockRenderer } from "@/components/blocks/registry";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { AttachmentStrip } from "./attachment-strip";

export type MessageBubbleProps = {
  message: Message;
  /** Only set for the currently-active assistant message; its blocks replace persisted content. */
  live?: LiveView | null;
  onRetry?: (message: Message) => void;
  onOpenAsset: (url: string) => void;
};

async function copyMessage(message: Message): Promise<void> {
  try {
    await navigator.clipboard.writeText(blocksToPlainText(message.content));
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy — try selecting the text instead");
  }
}

export function MessageBubble({ message, live, onRetry, onOpenAsset }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const blocks = live ? live.blocks : message.content;
  const isFailed = message.status === "failed";
  const isCancelled = message.status === "cancelled";
  const isPending = message.status === "pending" && blocks.length === 0;

  return (
    <div
      className={cn("flex gap-3 px-4 py-2.5", isUser && "justify-end")}
      data-message-id={message.id}
      data-role={message.role}
      data-status={message.status}
    >
      <div className={cn("flex w-full max-w-(--message-max-width) flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {isUser && message.attachments.length > 0 ? <AttachmentStrip attachments={message.attachments} onOpenAsset={onOpenAsset} /> : null}

        <div
          className={cn(
            "min-w-0 rounded-2xl px-4 py-2.5",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
            isFailed && "border border-destructive/50 bg-destructive/10 text-foreground",
            isCancelled && "border border-border bg-muted/50 opacity-75",
          )}
        >
          {isPending ? (
            <div className="flex flex-col gap-1.5" aria-label="Waiting for a response">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {blocks.map((block, index) => (
                <BlockRenderer key={index} block={block} index={index} blocks={blocks} live={live ?? null} onOpenAsset={onOpenAsset} />
              ))}
              {live?.status === "running" || message.status === "streaming" ? (
                <span aria-hidden="true" className="inline-block h-4 w-1.5 animate-pulse bg-current align-text-bottom" />
              ) : null}
            </div>
          )}
        </div>

        {isCancelled ? <p className="text-xs text-muted-foreground">Cancelled</p> : null}

        {isFailed ? (
          <div className="flex gap-1.5">
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={() => onRetry(message)}>
                <RotateCcwIcon /> Retry
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void copyMessage(message)}>
              <CopyIcon /> Copy
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
