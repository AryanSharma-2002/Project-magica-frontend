"use client";
import { CoinsIcon } from "lucide-react";
import { MICROCREDITS_PER_CREDIT } from "@/contracts";
import { useBalance } from "@/queries/credits";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function CreditsPill() {
  const { data, isLoading } = useBalance();
  if (isLoading || !data) return <Skeleton className="h-6 w-20 rounded-full" />;
  const credits = (data.microcredits / MICROCREDITS_PER_CREDIT).toFixed(2);
  return (
    <Badge variant="secondary" className="gap-1 rounded-full px-2.5 py-1" title={`${data.microcredits.toLocaleString()} microcredits`}>
      <CoinsIcon className="size-3.5" />
      {credits}
    </Badge>
  );
}
