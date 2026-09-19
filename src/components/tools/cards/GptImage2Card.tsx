"use client";
import { Badge } from "@/components/ui/badge";
import { GptImage2Input, GptImage2Output } from "@/contracts";
import { ToolCardShell } from "../ToolCardShell";
import type { ToolCardProps } from "../types";

export function GptImage2Card({ toolUse, result, live, onOpenAsset }: ToolCardProps) {
  const input = GptImage2Input.safeParse(toolUse.input);
  const output = result?.output !== undefined ? GptImage2Output.safeParse(result.output) : null;

  return (
    <ToolCardShell toolUse={toolUse} result={result} live={live}>
      <div className="space-y-2">
        {input.success && (
          <>
            <p className="line-clamp-3 text-sm">{input.data.prompt}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{input.data.size}</Badge>
              <Badge variant="outline">{input.data.quality}</Badge>
              {input.data.image_urls && input.data.image_urls.length > 0 && <Badge variant="outline">edit ({input.data.image_urls.length} source)</Badge>}
            </div>
          </>
        )}
        {output?.success && (
          <ul className="grid grid-cols-3 gap-1.5" aria-label="Generated images">
            {output.data.images.map((url, i) => (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => onOpenAsset?.(url)}
                  className="aspect-square w-full overflow-hidden rounded focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={`Open generated image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Magica URL */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolCardShell>
  );
}
