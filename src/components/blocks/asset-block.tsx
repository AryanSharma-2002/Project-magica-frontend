"use client";
import { FileIcon, ImageIcon, MusicIcon, VideoIcon } from "lucide-react";
import type { AssetBlock, AttachmentKind } from "@/contracts";
import { formatDuration } from "@/components/tools/format";

/**
 * FIDELITY.md "Conversation §4": a generated asset renders as a card (40px thumbnail/icon, title,
 * subtitle, action), not an inline preview — clicking it opens the artifact panel (`onOpenAsset`).
 */
function KindIcon({ kind, className }: { kind: AttachmentKind; className?: string }) {
  if (kind === "video") return <VideoIcon className={className} aria-hidden="true" />;
  if (kind === "audio") return <MusicIcon className={className} aria-hidden="true" />;
  if (kind === "file") return <FileIcon className={className} aria-hidden="true" />;
  return <ImageIcon className={className} aria-hidden="true" />;
}

const KIND_TITLE: Record<AttachmentKind, string> = {
  image: "Generated image",
  video: "Generated video",
  audio: "Generated audio",
  file: "Generated file",
};

function filenameFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.split("/").filter(Boolean).at(-1) || null;
  } catch {
    return null;
  }
}

function titleFor(block: AssetBlock): string {
  if (block.kind === "file") return filenameFromUrl(block.url) ?? KIND_TITLE.file;
  return KIND_TITLE[block.kind];
}

function subtitleFor(block: AssetBlock): string {
  if (block.kind === "image" && block.width && block.height) return `${block.width}×${block.height}`;
  if ((block.kind === "video" || block.kind === "audio") && block.durationMs != null) return formatDuration(block.durationMs);
  return block.kind === "file" ? "File" : block.kind.charAt(0).toUpperCase() + block.kind.slice(1);
}

export function AssetBlockView({ block, onOpenAsset }: { block: AssetBlock; onOpenAsset: (url: string) => void }) {
  const title = titleFor(block);
  const subtitle = subtitleFor(block);
  const action = block.kind === "file" ? "Download" : "View";

  return (
    <button
      type="button"
      onClick={() => onOpenAsset(block.url)}
      className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`${action} ${title}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {block.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote, provider-hosted, unknown dimensions
          <img src={block.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <KindIcon kind={block.kind} className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-foreground">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-foreground">{action}</span>
    </button>
  );
}
