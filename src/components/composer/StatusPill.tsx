"use client";
import { Badge } from "@/components/ui/badge";
import type { ModelInfo } from "@/contracts";
import { cn } from "@/lib/utils";

const STATUS_META: Record<ModelInfo["status"], { label: string; dot: string; variant: "secondary" | "outline" | "destructive" }> = {
  available: { label: "Available", dot: "bg-emerald-500", variant: "secondary" },
  degraded: { label: "Degraded", dot: "bg-amber-500", variant: "outline" },
  unavailable: { label: "Unavailable", dot: "bg-destructive", variant: "destructive" },
  unknown: { label: "Status unknown", dot: "bg-muted-foreground", variant: "outline" },
};

export function StatusPill({ model }: { model: ModelInfo | undefined }) {
  if (!model) return null;
  const meta = STATUS_META[model.status];
  return (
    <Badge variant={meta.variant} className="gap-1.5" title={`${model.label}: ${meta.label}`}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      <span>{model.label}</span>
      <span className="sr-only"> — {meta.label}</span>
    </Badge>
  );
}
