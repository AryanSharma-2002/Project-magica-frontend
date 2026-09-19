"use client";
import type { Waitpoint, WaitpointResolution } from "@/contracts";

/** Approval / options / plan / credit overlays (F2). Rendered by the shell when a run is `waiting`. */
export type WaitpointOverlayProps = {
  waitpoint: Waitpoint;
  onResolve: (resolution: WaitpointResolution) => Promise<void>;
  busy?: boolean;
};

export function WaitpointOverlay(_props: WaitpointOverlayProps) {
  return null;
}
