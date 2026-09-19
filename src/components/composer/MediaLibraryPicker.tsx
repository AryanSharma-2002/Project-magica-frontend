"use client";
import { useState } from "react";
import { FileIcon, ImageIcon, Loader2, Music, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Attachment, AttachmentSource } from "@/contracts";
import { useAttachmentsLibrary } from "@/queries/attachments";

function kindIcon(kind: Attachment["kind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "video") return VideoIcon;
  if (kind === "audio") return Music;
  return FileIcon;
}

const TABS: { value: AttachmentSource; label: string }[] = [
  { value: "upload", label: "Uploads" },
  { value: "generated", label: "Generated" },
];

function LibraryTab({ source, onSelect }: { source: AttachmentSource; onSelect: (attachment: Attachment) => void }) {
  const query = useAttachmentsLibrary(source);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading media…</span>
      </div>
    );
  }

  if (query.isError) {
    return <p className="py-4 text-center text-xs text-destructive">Couldn&apos;t load your media. Try again.</p>;
  }

  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Nothing here yet.</p>;
  }

  return (
    <ScrollArea className="h-64">
      <ul className="grid grid-cols-3 gap-1.5 p-0.5" aria-label={`${source} media`}>
        {items.map((item) => {
          const Icon = kindIcon(item.kind);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-md border border-border bg-muted hover:ring-2 hover:ring-ring/50"
                aria-label={`Add ${item.filename}`}
              >
                {item.previewUrl && item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Transloadit/Magica URL
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {query.hasNextPage && (
        <div className="flex justify-center p-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
    </ScrollArea>
  );
}

export function MediaLibraryPicker({ trigger, onSelect }: { trigger: React.ReactNode; onSelect: (attachment: Attachment) => void }) {
  const [source, setSource] = useState<AttachmentSource>("upload");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex gap-1" role="tablist" aria-label="Media source">
          {TABS.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={source === tab.value}
              variant={source === tab.value ? "secondary" : "ghost"}
              size="sm"
              className={cn("flex-1")}
              onClick={() => setSource(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Separator />
        <LibraryTab
          source={source}
          onSelect={(attachment) => {
            onSelect(attachment);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
