"use client";
import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SafeError } from "@/contracts";

/** Exact copy per FIDELITY.md "Conversation §5". */
export const FAILED_FALLBACK_MESSAGE = "Agent failed to complete this response. Please try again.";
export const CANCELLED_MESSAGE = "Response cancelled.";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px] rounded-lg border border-border bg-card px-4 py-[10px]">
      <InfoIcon className="size-4 shrink-0 text-(--text-subtle)" aria-hidden="true" />
      {children}
    </div>
  );
}

export function FailedCard({ error, onRetry }: { error?: SafeError; onRetry?: () => void }) {
  return (
    <Card>
      <p className="flex-1 text-sm text-(--text-subtle)">{error?.message || FAILED_FALLBACK_MESSAGE}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="h-auto shrink-0 rounded-[4px] px-3 py-1 text-xs font-medium text-muted-foreground"
        >
          Retry
        </Button>
      ) : null}
    </Card>
  );
}

export function CancelledCard() {
  return (
    <Card>
      <p className="flex-1 text-sm text-(--text-subtle)">{CANCELLED_MESSAGE}</p>
    </Card>
  );
}
