"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AssetBlock } from "@/contracts";

/** Right-hand artifact panel (F2) for generated images/videos/audio. */
export type ArtifactPanelProps = {
  assets: AssetBlock[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUrl?: string | null;
};

function filenameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname.split("/").filter(Boolean).at(-1) || "asset";
  } catch {
    return "asset";
  }
}

export function ArtifactPanel({ assets, open, onOpenChange, selectedUrl }: ArtifactPanelProps) {
  const [index, setIndex] = useState(() => {
    const found = selectedUrl ? assets.findIndex((a) => a.url === selectedUrl) : -1;
    return found >= 0 ? found : 0;
  });
  // Track the last `selectedUrl` we synced from, and re-sync during render (not in an effect) when
  // the caller passes a different one — e.g. a tool card's onOpenAsset(url). This is the React-docs
  // "adjust state while rendering" pattern: it re-derives `index` for the new prop without an extra
  // render pass and without a setState-in-effect.
  const [syncedUrl, setSyncedUrl] = useState<string | null>(selectedUrl ?? null);
  if ((selectedUrl ?? null) !== syncedUrl) {
    setSyncedUrl(selectedUrl ?? null);
    const found = selectedUrl ? assets.findIndex((a) => a.url === selectedUrl) : -1;
    if (found >= 0) setIndex(found);
  }

  const clampedIndex = assets.length === 0 ? -1 : Math.min(index, assets.length - 1);
  const selected = clampedIndex >= 0 ? assets[clampedIndex] : undefined;

  const goTo = (next: number) => {
    if (assets.length === 0) return;
    setIndex(Math.max(0, Math.min(assets.length - 1, next)));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(clampedIndex - 1);
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(clampedIndex + 1);
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>Generated assets</SheetTitle>
        </SheetHeader>

        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-4 text-center text-sm text-muted-foreground">
            <ImageOff className="size-8" aria-hidden="true" />
            <p>No generated assets yet.</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-muted">
              {selected.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- remote Magica/Transloadit URL
                <img src={selected.url} alt="" className="max-h-full max-w-full object-contain" />
              )}
              {selected.kind === "video" && <video src={selected.url} controls className="max-h-full max-w-full" />}
              {selected.kind === "audio" && <audio src={selected.url} controls className="w-full" />}
              {selected.kind === "file" && <p className="p-4 text-sm text-muted-foreground">{filenameFromUrl(selected.url)}</p>}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon-sm" onClick={() => goTo(clampedIndex - 1)} disabled={clampedIndex <= 0} aria-label="Previous asset">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground" aria-live="polite">{`${clampedIndex + 1} / ${assets.length}`}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => goTo(clampedIndex + 1)}
                  disabled={clampedIndex >= assets.length - 1}
                  aria-label="Next asset"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="outline" size="sm">
                  <a href={selected.url} download={filenameFromUrl(selected.url)}>
                    <Download className="size-4" /> Download
                  </a>
                </Button>
                <Button asChild variant="outline" size="icon-sm">
                  <a href={selected.url} target="_blank" rel="noreferrer" aria-label="Open asset in new tab">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>

            <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Generated assets filmstrip">
              {assets.map((asset, i) => (
                <li key={`${asset.url}-${i}`}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === clampedIndex}
                    aria-label={`View asset ${i + 1} of ${assets.length}`}
                    className={cn("size-14 shrink-0 overflow-hidden rounded border-2", i === clampedIndex ? "border-primary" : "border-transparent")}
                  >
                    {asset.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Magica/Transloadit URL
                      <img src={asset.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">{asset.kind}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
