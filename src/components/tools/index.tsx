"use client";
import { TOOL_NAMES, type ToolName } from "@/contracts";
import { CropImageCard } from "./cards/CropImageCard";
import { GptImage2Card } from "./cards/GptImage2Card";
import { MergeVideosCard } from "./cards/MergeVideosCard";
import { SkillCard } from "./cards/SkillCard";
import { DefaultToolCard } from "./DefaultToolCard";
import type { ToolCardProps } from "./types";

export type { ToolCardProps } from "./types";

type ToolCardComponent = (props: ToolCardProps) => React.ReactElement | null;

/** Registry: adding a tool touches only this map (+ one card component). Unknown tool names fall back to DefaultToolCard. */
export const toolCards: Record<ToolName, ToolCardComponent> = {
  crop_image: CropImageCard,
  gpt_image_2: GptImage2Card,
  merge_videos: MergeVideosCard,
  load_skill: SkillCard,
  read_skill_asset: SkillCard,
};

const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set(TOOL_NAMES);

export function ToolCard(props: ToolCardProps) {
  const Card = KNOWN_TOOL_NAMES.has(props.toolUse.toolName) ? toolCards[props.toolUse.toolName as ToolName] : DefaultToolCard;
  return <Card {...props} />;
}
