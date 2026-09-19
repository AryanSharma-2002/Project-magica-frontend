import { LinkIcon } from "lucide-react";
import type { CitationBlock } from "@/contracts";

export function CitationBlockView({ block }: { block: CitationBlock }) {
  return (
    <a
      href={block.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-accent"
    >
      <span className="flex items-center gap-1.5 font-medium">
        <LinkIcon className="size-3.5 shrink-0" />
        {block.title ?? block.url}
      </span>
      {block.snippet ? <span className="line-clamp-2 text-xs text-muted-foreground">{block.snippet}</span> : null}
    </a>
  );
}
