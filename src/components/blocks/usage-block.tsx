import type { UsageBlock } from "@/contracts";

export function UsageBlockView({ block }: { block: UsageBlock }) {
  return (
    <p className="text-xs text-muted-foreground">
      {block.model} · {block.totalTokens.toLocaleString()} tokens
    </p>
  );
}
