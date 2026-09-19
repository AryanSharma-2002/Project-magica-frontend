import { useQuery } from "@tanstack/react-query";
import type { ToolName } from "@/contracts";
import { configService } from "@/services/config";
import { qk } from "@/queries/keys";

/** Fallback labels for the known tools; used until `/config` resolves (or if it 404s a tool). */
const FALLBACK_LABELS: Record<ToolName, string> = {
  crop_image: "Crop image",
  gpt_image_2: "Generate image",
  merge_videos: "Merge videos",
  load_skill: "Load skill",
  read_skill_asset: "Read skill asset",
};

function humanize(toolName: string): string {
  const words = toolName.split(/[_-]+/).filter(Boolean);
  if (words.length === 0) return toolName;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

/** Backend-owned label for a tool, from `useConfig().tools` (ARCHITECTURE §11) with a local fallback. */
export function useToolLabel(toolName: string): string {
  const { data } = useQuery({ queryKey: qk.config, queryFn: ({ signal }) => configService.get(signal), staleTime: 5 * 60_000 });
  const descriptor = data?.tools.find((t) => t.name === toolName);
  if (descriptor) return descriptor.label;
  if (toolName in FALLBACK_LABELS) return FALLBACK_LABELS[toolName as ToolName];
  return humanize(toolName);
}
