"use client";
import type { LiveView } from "@/realtime/liveView";
import { Progress } from "@/components/ui/progress";

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Narration only (the run's `step` string, thinking time, progress) — no generic "Working…"/
 * "Queued…" fallback label, since the assistant message's own step-group header
 * (message-bubble.tsx / step-group.tsx) already renders that; a second copy here would fight it
 * for the same `getByText` and read as a duplicate "Working…" on screen.
 */
export function StreamingStatus({ live }: { live: LiveView }) {
  if (!live.step && live.thinkingMs == null && live.progress == null) return null;
  return (
    <div className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground" role="status">
      {live.step ? <span>{live.step}</span> : null}
      {live.thinkingMs != null ? <span>· thought for {formatMs(live.thinkingMs)}</span> : null}
      {live.progress != null ? <Progress value={live.progress * 100} className="h-1 w-24" /> : null}
    </div>
  );
}
