"use client";
import type { AssetBlock } from "@/contracts";

/** Right-hand artifact panel (F2) for generated images/videos/audio. */
export type ArtifactPanelProps = {
  assets: AssetBlock[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUrl?: string | null;
};

export function ArtifactPanel(_props: ArtifactPanelProps) {
  return null;
}
