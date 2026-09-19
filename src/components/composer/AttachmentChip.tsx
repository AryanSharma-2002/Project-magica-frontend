"use client";
import { FileIcon, ImageIcon, Loader2, Music, RotateCcw, VideoIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PendingAttachment } from "@/stores/composer";
import { formatBytes } from "./validation";

/** A static component (not a dynamically-selected reference) so it's safe to render conditionally. */
function KindIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className={className} aria-hidden="true" />;
  if (mimeType.startsWith("video/")) return <VideoIcon className={className} aria-hidden="true" />;
  if (mimeType.startsWith("audio/")) return <Music className={className} aria-hidden="true" />;
  return <FileIcon className={className} aria-hidden="true" />;
}

export type AttachmentChipProps = {
  attachment: PendingAttachment;
  onRemove: (clientId: string) => void;
  onRetry: (clientId: string) => void;
};

export function AttachmentChip({ attachment, onRemove, onRetry }: AttachmentChipProps) {
  const isImage = attachment.mimeType.startsWith("image/") && !!attachment.previewUrl;
  const isBusy = attachment.status === "queued" || attachment.status === "uploading" || attachment.status === "processing";
  const isFailed = attachment.status === "failed";

  return (
    <div
      className={cn(
        "flex w-40 flex-col gap-1 rounded-lg border p-1.5",
        isFailed ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
      )}
      data-status={attachment.status}
    >
      <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL / remote preview, not an app asset
          <img src={attachment.previewUrl ?? undefined} alt="" className="h-full w-full object-cover" />
        ) : (
          <KindIcon mimeType={attachment.mimeType} className="size-6 text-muted-foreground" />
        )}
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-4 animate-spin text-foreground" aria-hidden="true" />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1 right-1 bg-background/80 hover:bg-background"
          onClick={() => onRemove(attachment.clientId)}
          aria-label={`Remove ${attachment.filename}`}
        >
          <X className="size-3" />
        </Button>
      </div>
      <p className="truncate text-xs font-medium" title={attachment.filename}>
        {attachment.filename}
      </p>
      {isBusy ? (
        <Progress value={attachment.progress} className="h-1" aria-label={`Upload progress for ${attachment.filename}`} />
      ) : (
        <p className="text-[11px] text-muted-foreground">{formatBytes(attachment.sizeBytes)}</p>
      )}
      {isFailed && (
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] text-destructive" title={attachment.error ?? "Upload failed"}>
            {attachment.error ?? "Upload failed"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRetry(attachment.clientId)}
            aria-label={`Retry uploading ${attachment.filename}`}
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      )}
      {!isFailed && attachment.error && <p className="truncate text-[11px] text-muted-foreground">{attachment.error}</p>}
    </div>
  );
}
