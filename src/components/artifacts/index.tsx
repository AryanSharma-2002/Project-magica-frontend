"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImageOff, Images, Maximize2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssetBlock } from "@/contracts";

/**
 * Right-hand artifact panel (F2) for generated images/videos/audio.
 *
 * FIDELITY.md "Shell": "right side, full height, 1px left border, header row with icon + title on
 * the left and reload / maximize / close icon buttons on the right" — the reference has no dimming
 * overlay and the message column simply narrows next to it, so this is a plain `<aside>` that
 * chat-screen.tsx renders as a flex sibling (see chat-screen.tsx, not owned by this slice), not a
 * portal-based Sheet/Dialog.
 */
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
  // Re-sync during render (not in an effect) when the caller passes a different `selectedUrl`
  // while the panel is already open — e.g. a tool card's onOpenAsset(url) for a different asset.
  // This is the React-docs "adjust state while rendering" pattern. Reopening after a close is
  // handled for free: the panel unmounts when `open` is false (see the early return below), so a
  // fresh mount re-derives `index` from `selectedUrl` via the `useState` initializer above.
  const [syncedUrl, setSyncedUrl] = useState<string | null>(selectedUrl ?? null);
  if ((selectedUrl ?? null) !== syncedUrl) {
    setSyncedUrl(selectedUrl ?? null);
    const found = selectedUrl ? assets.findIndex((a) => a.url === selectedUrl) : -1;
    if (found >= 0) setIndex(found);
  }

  const [reloadKey, setReloadKey] = useState(0);
  const panelRef = useRef<HTMLElement>(null);

  // Focus the panel on (re)open so ArrowLeft/ArrowRight reach its onKeyDown handler.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const clampedIndex = assets.length === 0 ? -1 : Math.min(index, assets.length - 1);
  const selected = clampedIndex >= 0 ? assets[clampedIndex] : undefined;

  const goTo = (next: number) => {
    if (assets.length === 0) return;
    setIndex(Math.max(0, Math.min(assets.length - 1, next)));
  };

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label="Artifact panel"
      className="flex h-full w-(--artifact-panel-width) shrink-0 flex-col border-l border-border bg-background outline-none"
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Images className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Generated assets</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reload"
            disabled={!selected}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
          {selected ? (
            <Button asChild variant="ghost" size="icon-sm">
              <a href={selected.url} target="_blank" rel="noreferrer" aria-label="Open asset in new tab">
                <Maximize2 className="size-4" />
              </a>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Open asset in new tab" disabled>
              <Maximize2 className="size-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {!selected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-4 text-center text-sm text-muted-foreground">
          <ImageOff className="size-8" aria-hidden="true" />
          <p>No generated assets yet.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-muted">
            {selected.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- remote Magica/Transloadit URL
              <img key={reloadKey} src={selected.url} alt="" className="max-h-full max-w-full object-contain" />
            )}
            {selected.kind === "video" && <video key={reloadKey} src={selected.url} controls className="max-h-full max-w-full" />}
            {selected.kind === "audio" && <audio key={reloadKey} src={selected.url} controls className="w-full" />}
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
    </aside>
  );
}
