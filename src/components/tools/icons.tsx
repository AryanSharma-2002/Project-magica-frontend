import { BookOpen, Combine, Crop, ImagePlus, Wrench } from "lucide-react";

/**
 * Step-row icon per tool name (messages/step-group.tsx); unknown tools fall back to a generic
 * wrench. Written as explicit conditional returns (not `const Icon = lookup[name]; <Icon/>`) so
 * the React Compiler doesn't flag a "component created during render" — same shape as
 * `tools/ToolCardShell.tsx`'s `StatusIcon`.
 */
export function ToolIcon({ toolName, className }: { toolName: string; className?: string }) {
  if (toolName === "crop_image") return <Crop className={className} aria-hidden="true" />;
  if (toolName === "gpt_image_2") return <ImagePlus className={className} aria-hidden="true" />;
  if (toolName === "merge_videos") return <Combine className={className} aria-hidden="true" />;
  if (toolName === "load_skill" || toolName === "read_skill_asset") return <BookOpen className={className} aria-hidden="true" />;
  return <Wrench className={className} aria-hidden="true" />;
}
