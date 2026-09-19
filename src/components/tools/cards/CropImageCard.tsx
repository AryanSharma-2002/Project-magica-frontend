"use client";
import { CropImageInput, CropImageOutput } from "@/contracts";
import { ToolCardShell } from "../ToolCardShell";
import type { ToolCardProps } from "../types";

function cropSummary(input: CropImageInput): string {
  if (input.crop) {
    const { x, y, width, height } = input.crop;
    return `Crop ${width.toFixed(0)}% × ${height.toFixed(0)}% at (${x.toFixed(0)}%, ${y.toFixed(0)}%)`;
  }
  if (input.width_percent !== undefined) {
    return `Crop ${input.width_percent.toFixed(0)}% × ${(input.height_percent ?? 0).toFixed(0)}% at (${(input.x_percent ?? 0).toFixed(0)}%, ${(input.y_percent ?? 0).toFixed(0)}%)`;
  }
  if (input.width_px !== undefined) {
    const pos = input.x_px !== undefined && input.y_px !== undefined ? ` at (${input.x_px}px, ${input.y_px}px)` : " (centered)";
    return `Crop ${input.width_px}px × ${input.height_px}px${pos}`;
  }
  return "Crop image";
}

export function CropImageCard({ toolUse, result, live, onOpenAsset }: ToolCardProps) {
  const input = CropImageInput.safeParse(toolUse.input);
  const output = result?.output !== undefined ? CropImageOutput.safeParse(result.output) : null;

  return (
    <ToolCardShell toolUse={toolUse} result={result} live={live}>
      <div className="flex flex-wrap items-start gap-3">
        {input.success && (
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Magica/Transloadit URL */}
            <img src={input.data.image_url} alt="Source image" className="h-20 w-20 rounded object-cover" />
            <figcaption className="max-w-40 text-xs text-muted-foreground">{cropSummary(input.data)}</figcaption>
          </figure>
        )}
        {output?.success && (
          <button
            type="button"
            onClick={() => onOpenAsset?.(output.data.image_url)}
            className="rounded focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Open cropped image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Magica/Transloadit URL */}
            <img src={output.data.image_url} alt="Cropped result" className="h-20 w-20 rounded object-cover" />
          </button>
        )}
      </div>
    </ToolCardShell>
  );
}
