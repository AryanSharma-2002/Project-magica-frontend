"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Ban, CheckCircle2, Clock, Copy, Hourglass, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SafeError, ToolInvocationStatus } from "@/contracts";
import { formatCredits, formatDuration } from "./format";
import { useToolLabel } from "./labels";
import type { ToolCardProps } from "./types";

const STATUS_META: Record<ToolInvocationStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-muted-foreground" },
  running: { label: "Running", className: "text-foreground" },
  waiting_approval: { label: "Waiting for approval", className: "text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", className: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Failed", className: "text-destructive" },
  cancelled: { label: "Cancelled", className: "text-muted-foreground" },
};

function StatusIcon({ status }: { status: ToolInvocationStatus }) {
  const className = "size-3.5";
  if (status === "running") return <Loader2 className={cn(className, "animate-spin")} aria-hidden="true" />;
  if (status === "waiting_approval") return <Hourglass className={className} aria-hidden="true" />;
  if (status === "completed") return <CheckCircle2 className={className} aria-hidden="true" />;
  if (status === "failed") return <XCircle className={className} aria-hidden="true" />;
  if (status === "cancelled") return <Ban className={className} aria-hidden="true" />;
  return <Clock className={className} aria-hidden="true" />;
}

/** Ticks once a second while `running` so the elapsed time in a running card keeps moving. */
function useElapsedMs(startedAt: string | null | undefined, finishedAt: string | null | undefined, running: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!startedAt) return null;
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="gap-1 text-muted-foreground"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(id).then(() => setCopied(true));
        }
      }}
      aria-label={`Copy provider run id ${id}`}
    >
      <Copy className="size-3" aria-hidden="true" />
      <span className="max-w-32 truncate font-mono">{id}</span>
      {copied && <span className="sr-only">Copied</span>}
    </Button>
  );
}

function ErrorNote({ error }: { error: SafeError }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
      <p>{error.message}</p>
      <p className="mt-0.5 text-[11px] text-destructive/70">
        Code: {error.code}
        {error.retryable ? " · You can try again." : ""}
      </p>
    </div>
  );
}

function safeJson(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 4000 ? `${text.slice(0, 4000)}\n… (truncated)` : text;
  } catch {
    return String(value);
  }
}

export type ToolCardShellProps = Pick<ToolCardProps, "toolUse" | "result" | "live"> & { children?: ReactNode };

export function ToolCardShell({ toolUse, result, live, children }: ToolCardShellProps) {
  const label = useToolLabel(toolUse.toolName);
  const status: ToolInvocationStatus = live?.status ?? result?.status ?? "pending";
  const meta = STATUS_META[status];
  // Always called (never short-circuited) so the hook count stays stable across status transitions.
  const elapsedMs = useElapsedMs(live?.startedAt, live?.finishedAt, status === "running");
  const durationMs = result?.durationMs ?? elapsedMs;
  const credits = result?.microcredits ?? live?.microcredits;
  const error = result?.error ?? live?.error ?? null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm" data-status={status} role="group" aria-label={`${label}: ${meta.label}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className={cn("flex items-center gap-1.5 font-medium", meta.className)}>
          <StatusIcon status={status} />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{meta.label}</span>
          {durationMs != null && <span>{formatDuration(durationMs)}</span>}
          {credits != null && <span>{formatCredits(credits)}</span>}
        </div>
      </header>

      {live?.providerRunId && <CopyableId id={live.providerRunId} />}
      {error && <ErrorNote error={error} />}

      {children}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Details</summary>
        <div className="mt-1 space-y-2">
          <div>
            <p className="mb-0.5 font-medium text-muted-foreground">Input</p>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap break-words">{safeJson(toolUse.input)}</pre>
          </div>
          {result?.output !== undefined && (
            <div>
              <p className="mb-0.5 font-medium text-muted-foreground">Output</p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap break-words">{safeJson(result.output)}</pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
