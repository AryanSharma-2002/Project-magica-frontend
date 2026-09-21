"use client";
import { CopyIcon } from "lucide-react";
import {
  TERMINAL_RUN_STATUSES,
  type AssetBlock,
  type CitationBlock,
  type ErrorBlock,
  type Message,
  type ReasoningBlock,
  type RunStatus,
  type TextBlock,
  type ThinkingBlock,
  type ToolUseBlock,
} from "@/contracts";
import type { LiveView } from "@/realtime/liveView";
import { BlockRenderer } from "@/components/blocks/registry";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { AttachmentStrip } from "./attachment-strip";
import { copyMessage } from "./copy-message";
import { FailedCard, CancelledCard } from "./failed-card";
import { formatMessageTime } from "./format-time";
import { MessageFooter } from "./message-footer";
import { StepGroup } from "./step-group";

export type MessageBubbleProps = {
  message: Message;
  /** Only set for the currently-active assistant message; its blocks replace persisted content. */
  live?: LiveView | null;
  onRetry?: (message: Message) => void;
  onOpenAsset: (url: string) => void;
};

const TERMINAL_RUN_STATUS_SET = new Set<RunStatus>(TERMINAL_RUN_STATUSES);

type ProseBlock = TextBlock | ThinkingBlock | ReasoningBlock | CitationBlock;

function isProseBlock(block: { type: string }): block is ProseBlock {
  return block.type === "text" || block.type === "thinking" || block.type === "reasoning" || block.type === "citation";
}

/** FIDELITY.md "Conversation": right-aligned `--muted` bubble; hover-only time + copy. */
function UserMessage({ message, onRetry, onOpenAsset }: Omit<MessageBubbleProps, "live">) {
  const isFailed = message.status === "failed";
  const isCancelled = message.status === "cancelled";
  const errorBlock = message.content.find((b): b is ErrorBlock => b.type === "error");
  const textBlocks = message.content.filter((b): b is TextBlock => b.type === "text");

  return (
    <div className="group flex max-w-[85%] flex-col items-end gap-1 md:max-w-(--user-bubble-max-width)">
      {message.attachments.length > 0 ? <AttachmentStrip attachments={message.attachments} onOpenAsset={onOpenAsset} /> : null}

      <div className="min-w-0 rounded-[16px] bg-muted px-4 py-[6px] text-sm leading-5 text-foreground">
        {textBlocks.map((block, i) => (
          <BlockRenderer key={i} block={block} index={i} blocks={message.content} live={null} onOpenAsset={onOpenAsset} variant="user" />
        ))}
      </div>

      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <time className="text-xs text-muted-foreground" dateTime={message.createdAt}>
          {formatMessageTime(message.createdAt)}
        </time>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => void copyMessage(message)} aria-label="Copy message">
          <CopyIcon className="size-3" />
        </Button>
      </div>

      {isFailed ? <FailedCard error={errorBlock?.error} onRetry={onRetry ? () => onRetry(message) : undefined} /> : null}
      {isCancelled ? <CancelledCard /> : null}
    </div>
  );
}

/** FIDELITY.md "Conversation": no bubble; step group, prose, artifact cards, failed/cancelled card, footer. */
function AssistantMessage({ message, live, onRetry, onOpenAsset }: MessageBubbleProps) {
  const blocks = live ? live.blocks : message.content;
  const isFailed = message.status === "failed";
  const isCancelled = message.status === "cancelled";
  const isPending = message.status === "pending" && blocks.length === 0;
  // Broader than just `live.status`: on the first frame(s) of a run `useChatRun` may not have
  // attached live metadata yet (or `live.status` is still null), but `message.status` already
  // says pending/streaming — the step header must read "Working…" from that moment, not
  // "Completed N steps" before anything has actually finished.
  const isActive =
    (!!live?.status && !TERMINAL_RUN_STATUS_SET.has(live.status)) || message.status === "pending" || message.status === "streaming";
  const isStreamingText = live?.status === "running" || message.status === "streaming";

  const toolUseBlocks = blocks.filter((b): b is ToolUseBlock => b.type === "tool_use");
  const proseBlocks = blocks.filter(isProseBlock);
  const assetBlocks = blocks.filter((b): b is AssetBlock => b.type === "asset");
  const errorBlock = blocks.find((b): b is ErrorBlock => b.type === "error");

  return (
    <div className="flex w-full flex-col gap-2">
      {isPending ? (
        <div className="flex flex-col gap-1.5" aria-label="Waiting for a response">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : (
        <>
          <StepGroup toolUseBlocks={toolUseBlocks} blocks={blocks} live={live ?? null} isActive={isActive} onOpenAsset={onOpenAsset} />

          {proseBlocks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {proseBlocks.map((block, i) => (
                <BlockRenderer key={i} block={block} index={i} blocks={blocks} live={live ?? null} onOpenAsset={onOpenAsset} variant="assistant" />
              ))}
              {isStreamingText ? (
                <span aria-hidden="true" className="inline-block h-4 w-1.5 animate-pulse bg-current align-text-bottom" />
              ) : null}
            </div>
          ) : null}

          {assetBlocks.map((block, i) => (
            <BlockRenderer key={`asset-${i}`} block={block} index={i} blocks={blocks} live={live ?? null} onOpenAsset={onOpenAsset} />
          ))}
        </>
      )}

      {isFailed ? <FailedCard error={errorBlock?.error} onRetry={onRetry ? () => onRetry(message) : undefined} /> : null}
      {isCancelled ? <CancelledCard /> : null}

      <MessageFooter message={message} blocks={blocks} />
    </div>
  );
}

export function MessageBubble({ message, live, onRetry, onOpenAsset }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("mx-auto flex w-full max-w-(--message-max-width) px-4 py-3", isUser ? "justify-end" : "justify-start")}
      data-message-id={message.id}
      data-role={message.role}
      data-status={message.status}
    >
      {isUser ? (
        <UserMessage message={message} onRetry={onRetry} onOpenAsset={onOpenAsset} />
      ) : (
        <AssistantMessage message={message} live={live} onRetry={onRetry} onOpenAsset={onOpenAsset} />
      )}
    </div>
  );
}
