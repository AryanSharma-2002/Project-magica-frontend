"use client";
import { ToolCardShell } from "./ToolCardShell";
import type { ToolCardProps } from "./types";

/** Fallback for any tool without a dedicated card: the shared shell already renders sanitized JSON input/output. */
export function DefaultToolCard({ toolUse, result, live }: ToolCardProps) {
  return <ToolCardShell toolUse={toolUse} result={result} live={live} />;
}
