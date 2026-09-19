"use client";
import type { LiveView } from "@/realtime/liveView";
import { Progress } from "@/components/ui/progress";

const STATUS_LABEL: Partial<Record<NonNullable<LiveView["status"]>, string>> = {
  queued: "Queued…",
  running: "Working…",
  waiting: "Waiting for your approval",
  stopping: "Stopping…",
  completed: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function StreamingStatus({ live }: { live: LiveView }) {
  if (!live.status) return null;
  const label = live.step ?? STATUS_LABEL[live.status] ?? live.status;
  return (
    <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground" role="status">
      <span>{label}</span>
      {live.thinkingMs != null ? <span>· thought for {formatMs(live.thinkingMs)}</span> : null}
      {live.progress != null ? <Progress value={live.progress * 100} className="h-1 w-24" /> : null}
    </div>
  );
}
