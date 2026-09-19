import type { LiveToolState, ToolResultBlock, ToolUseBlock } from "@/contracts";

/**
 * Tool activity card (F2): registry keyed by toolName with a default JSON card.
 * The message block renderer (F1) calls this for every tool_use block, passing the matching tool_result
 * (persisted) and/or live state (realtime metadata) so pending/running/completed/failed/cancelled render distinctly.
 */
export type ToolCardProps = {
  toolUse: ToolUseBlock;
  result: ToolResultBlock | null;
  live: LiveToolState | null;
  onOpenAsset?: (url: string) => void;
};
