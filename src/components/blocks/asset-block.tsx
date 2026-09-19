"use client";
import type { AssetBlock } from "@/contracts";

export function AssetBlockView({ block, onOpenAsset }: { block: AssetBlock; onOpenAsset: (url: string) => void }) {
  const commonProps = {
    className: "max-h-80 w-auto max-w-full cursor-pointer rounded-md border border-border/60",
    onClick: () => onOpenAsset(block.url),
  };
  if (block.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- remote, provider-hosted, unknown dimensions
    return <img src={block.url} alt="Generated asset" {...commonProps} />;
  }
  if (block.kind === "video") {
    return <video src={block.url} controls {...commonProps} />;
  }
  if (block.kind === "audio") {
    return <audio src={block.url} controls className="w-full cursor-pointer" onClick={() => onOpenAsset(block.url)} />;
  }
  return (
    <button type="button" onClick={() => onOpenAsset(block.url)} className="rounded-md border border-border/60 px-3 py-2 text-left text-sm underline">
      Open attachment
    </button>
  );
}
