"use client";
import { ToolCard } from "@/components/tools";
import type { BlockRendererProps } from "./registry";

/** `tool_use` renders the card, pairing with its `tool_result` (by toolCallId) from the full
 *  blocks array and its live state (by toolCallId) from the run's live view. */
export function ToolUseBlockView({ block, blocks, live, onOpenAsset }: BlockRendererProps) {
  if (block.type !== "tool_use") return null;
  const result = blocks.find((b) => b.type === "tool_result" && b.toolCallId === block.toolCallId);
  return (
    <ToolCard
      toolUse={block}
      result={result && result.type === "tool_result" ? result : null}
      live={live?.tools[block.toolCallId] ?? null}
      onOpenAsset={onOpenAsset}
    />
  );
}

/** Consumed by the paired `tool_use` renderer above; rendering it again here would duplicate the card. */
export function ToolResultBlockView() {
  return null;
}
