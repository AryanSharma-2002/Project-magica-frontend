"use client";
import type { ComponentType } from "react";
import type { ContentBlock, ContentBlockType } from "@/contracts";
import type { LiveView } from "@/realtime/liveView";
import { TextBlockView } from "./text-block";
import { ThinkingBlockView } from "./thinking-block";
import { ReasoningBlockView } from "./reasoning-block";
import { ToolUseBlockView, ToolResultBlockView } from "./tool-block";
import { CitationBlockView } from "./citation-block";
import { UsageBlockView } from "./usage-block";
import { AssetBlockView } from "./asset-block";
import { ErrorBlockView } from "./error-block";

/**
 * Rendering is registry-driven (ARCHITECTURE rule 4): adding a `ContentBlockType` touches only
 * this map. `blocks`/`live` are passed to every renderer so `tool_use` can pair itself with its
 * `tool_result` (by `toolCallId`) and its live state without every renderer needing bespoke wiring.
 */
export type BlockRendererProps = {
  block: ContentBlock;
  index: number;
  blocks: ContentBlock[];
  live: LiveView | null;
  onOpenAsset: (url: string) => void;
};

export const blockRenderers: Record<ContentBlockType, ComponentType<BlockRendererProps>> = {
  text: ({ block }) => (block.type === "text" ? <TextBlockView block={block} /> : null),
  thinking: ({ block }) => (block.type === "thinking" ? <ThinkingBlockView block={block} /> : null),
  reasoning: ({ block }) => (block.type === "reasoning" ? <ReasoningBlockView block={block} /> : null),
  tool_use: (props) => <ToolUseBlockView {...props} />,
  tool_result: () => <ToolResultBlockView />,
  citation: ({ block }) => (block.type === "citation" ? <CitationBlockView block={block} /> : null),
  usage: ({ block }) => (block.type === "usage" ? <UsageBlockView block={block} /> : null),
  asset: ({ block, onOpenAsset }) => (block.type === "asset" ? <AssetBlockView block={block} onOpenAsset={onOpenAsset} /> : null),
  error: ({ block }) => (block.type === "error" ? <ErrorBlockView error={block.error} /> : null),
};

export function BlockRenderer(props: BlockRendererProps) {
  const Renderer = blockRenderers[props.block.type];
  return <Renderer {...props} />;
}
