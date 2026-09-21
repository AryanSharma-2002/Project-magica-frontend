"use client";
import { CoinsIcon } from "lucide-react";
import { useBalance } from "@/queries/credits";
import { formatCredits } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

/**
 * Top bar credits pill (FIDELITY.md "Shell" + "Credits"): `formatCredits(balance)`, e.g. "100.00M".
 * 28px tall to match the model selector; 0.5px border per the reference (Tokens: --border/--input).
 */
export function CreditsPill({ className }: { className?: string }) {
  const { data, isLoading } = useBalance();

  if (isLoading || !data) return <Skeleton className={cn("h-7 w-16 rounded-full", className)} />;

  const label = formatCredits(data.microcredits);
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-sm text-foreground",
        className,
      )}
      style={{ borderWidth: "0.5px" }}
      title={`${data.microcredits.toLocaleString()} microcredits`}
    >
      <CoinsIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {label}
    </span>
  );
}
