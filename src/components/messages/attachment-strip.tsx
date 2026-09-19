import { FileIcon, FileVideoIcon, MusicIcon } from "lucide-react";
import type { Attachment } from "@/contracts";

export function AttachmentStrip({ attachments, onOpenAsset }: { attachments: Attachment[]; onOpenAsset: (url: string) => void }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((a) => (
        <AttachmentThumb key={a.id} attachment={a} onOpenAsset={onOpenAsset} />
      ))}
    </div>
  );
}

function AttachmentThumb({ attachment, onOpenAsset }: { attachment: Attachment; onOpenAsset: (url: string) => void }) {
  const open = () => attachment.url && onOpenAsset(attachment.url);
  if (attachment.kind === "image" && (attachment.previewUrl ?? attachment.url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote, provider-hosted preview
      <img
        src={attachment.previewUrl ?? attachment.url ?? undefined}
        alt={attachment.filename}
        onClick={open}
        className="size-16 cursor-pointer rounded-md border border-border/60 object-cover"
      />
    );
  }
  const Icon = attachment.kind === "video" ? FileVideoIcon : attachment.kind === "audio" ? MusicIcon : FileIcon;
  return (
    <button
      type="button"
      onClick={open}
      className="flex max-w-40 items-center gap-1.5 truncate rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
      title={attachment.filename}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{attachment.filename}</span>
    </button>
  );
}
