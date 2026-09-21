"use client";
import { Coins, CopyIcon } from "lucide-react";
import type { ContentBlock, Message, UsageBlock } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { copyMessage } from "./copy-message";
import { formatCredits } from "./format-credits";
import { formatMessageTime } from "./format-time";

const TERMINAL_MESSAGE_STATUSES = new Set<Message["status"]>(["completed", "failed", "cancelled"]);

function totalMicrocredits(blocks: ContentBlock[]): number {
  return blocks.reduce((sum, block) => {
    if (block.type === "tool_result" && block.microcredits) return sum + block.microcredits;
    if (block.type === "usage" && block.microcredits) return sum + block.microcredits;
    return sum;
  }, 0);
}

/**
 * FIDELITY.md "Conversation §6": "◎ N.NNM credits" (from tool charges + the usage block, since
 * `Message` carries no single "charged total"), then a copy icon + time — only once the message
 * is terminal, and only once there's something to copy for the time row.
 */
export function MessageFooter({ message, blocks }: { message: Message; blocks: ContentBlock[] }) {
  if (!TERMINAL_MESSAGE_STATUSES.has(message.status)) return null;

  const usage = blocks.find((b): b is UsageBlock => b.type === "usage") ?? null;
  const credits = totalMicrocredits(blocks);
  const showCredits = credits > 0 || usage != null;
  const showTimeRow = message.status === "completed";
  if (!showCredits && !showTimeRow) return null;

  return (
    <div className="flex flex-col gap-1 pt-1">
      {showCredits ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
                <Coins className="size-3" aria-hidden="true" />
                {formatCredits(credits)} credits
              </span>
            </TooltipTrigger>
            {usage ? (
              <TooltipContent>
                {usage.model} · {usage.totalTokens.toLocaleString()} tokens
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {showTimeRow ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => void copyMessage(message)} aria-label="Copy message">
            <CopyIcon className="size-3" />
          </Button>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </div>
      ) : null}
    </div>
  );
}
