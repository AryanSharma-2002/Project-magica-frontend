import type { ReasoningBlock } from "@/contracts";

export function ReasoningBlockView({ block }: { block: ReasoningBlock }) {
  return <p className="text-sm italic text-muted-foreground">{block.text}</p>;
}
