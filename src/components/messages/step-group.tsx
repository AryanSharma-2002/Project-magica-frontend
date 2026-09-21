"use client";
import { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { cn } from "cn";
import type { ContentBlock, LiveToolState, ToolResultBlock, ToolUseBlock } from "@/contracts";
import type { LiveView } from "@/realtime/liveView";
import { ToolCard } from "@/components/tools";
import { formatDuration, summarizeToolInput } from "@/components/tools/format";
import { useToolLabel } from "@/components/tools/labels";
import { ToolIcon } from "@/components/tools/icons";

/** Row label override for the two skill tools: FIDELITY.md's example row reads "Skill" with the
 *  skill name as the summary, not the backend's "Load skill" / "Read skill asset" tool label. */
const STEP_LABEL_OVERRIDE: Partial<Record<string, string>> = {
  load_skill: "Skill",
  read_skill_asset: "Skill",
};

function computeDurationMs(result: ToolResultBlock | null, live: LiveToolState | null): number | null {
  if (result?.durationMs != null) return result.durationMs;
  if (live?.startedAt && live?.finishedAt) {
    const start = new Date(live.startedAt).getTime();
    const end = new Date(live.finishedAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) return Math.max(0, end - start);
  }
  return null;
}

type StepRowProps = {
  toolUse: ToolUseBlock;
  result: ToolResultBlock | null;
  live: LiveToolState | null;
  expanded: boolean;
  onToggle: () => void;
  onOpenAsset: (url: string) => void;
};

function StepRow({ toolUse, result, live, expanded, onToggle, onOpenAsset }: StepRowProps) {
  const fallbackLabel = useToolLabel(toolUse.toolName);
  const label = STEP_LABEL_OVERRIDE[toolUse.toolName] ?? fallbackLabel;
  const summary = summarizeToolInput(toolUse.toolName, toolUse.input);
  const status = live?.status ?? result?.status ?? "pending";
  const durationMs = computeDurationMs(result, live);
  const isRunning = status === "running";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        data-status={status}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
      >
        {isRunning ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : isCancelled ? (
          <Ban className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ToolIcon toolName={toolUse.toolName} className={cn("size-4 shrink-0", isFailed ? "text-destructive" : "text-muted-foreground")} />
        )}
        <span className={cn("font-medium text-foreground", isCancelled && "text-muted-foreground line-through")}>{label}</span>
        {summary ? <span className="truncate text-muted-foreground">{summary}</span> : null}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{durationMs != null ? formatDuration(durationMs) : null}</span>
      </button>
      {expanded ? (
        <div className="pt-1 pl-6">
          <ToolCard toolUse={toolUse} result={result} live={live} onOpenAsset={onOpenAsset} />
        </div>
      ) : null}
    </li>
  );
}

export type StepGroupProps = {
  toolUseBlocks: ToolUseBlock[];
  blocks: ContentBlock[];
  live: LiveView | null;
  /** The owning message's run hasn't reached a terminal status yet: header reads "Working…". */
  isActive: boolean;
  onOpenAsset: (url: string) => void;
};

/**
 * FIDELITY.md "Conversation §1–2": the "Completed N steps" / "Working…" header toggles a list of
 * step rows; a run with zero tool calls shows no header at all.
 */
export function StepGroup({ toolUseBlocks, blocks, live, isActive, onOpenAsset }: StepGroupProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  if (toolUseBlocks.length === 0) return null;

  const count = toolUseBlocks.length;
  const label = isActive ? "Working…" : `Completed ${count} step${count === 1 ? "" : "s"}`;

  const toggleRow = (toolCallId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) next.delete(toolCallId);
      else next.add(toolCallId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("w-fit text-sm text-muted-foreground", isActive && "animate-pulse")}
      >
        {label}
      </button>
      {open ? (
        <ul className="flex flex-col gap-0.5">
          {toolUseBlocks.map((toolUse) => {
            const result =
              blocks.find((b): b is ToolResultBlock => b.type === "tool_result" && b.toolCallId === toolUse.toolCallId) ?? null;
            const liveState = live?.tools[toolUse.toolCallId] ?? null;
            return (
              <StepRow
                key={toolUse.toolCallId}
                toolUse={toolUse}
                result={result}
                live={liveState}
                expanded={expanded.has(toolUse.toolCallId)}
                onToggle={() => toggleRow(toolUse.toolCallId)}
                onOpenAsset={onOpenAsset}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
