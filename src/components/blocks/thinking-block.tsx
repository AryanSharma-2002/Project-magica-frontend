"use client";
import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import type { ThinkingBlock } from "@/contracts";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`;
}

export function ThinkingBlockView({ block }: { block: ThinkingBlock }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 text-sm text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left"
      >
        <ChevronRightIcon className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        <span>Thinking{block.durationMs != null ? ` for ${formatDuration(block.durationMs)}` : "…"}</span>
      </button>
      {open ? <div className="whitespace-pre-wrap px-3 pb-2 pl-8 text-xs">{block.text}</div> : null}
    </div>
  );
}
