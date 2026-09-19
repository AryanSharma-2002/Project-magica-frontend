"use client";
import { Badge } from "@/components/ui/badge";
import { MergeVideosInput, MergeVideosOutput } from "@/contracts";
import { ToolCardShell } from "../ToolCardShell";
import type { ToolCardProps } from "../types";

export function MergeVideosCard({ toolUse, result, live }: ToolCardProps) {
  const input = MergeVideosInput.safeParse(toolUse.input);
  const output = result?.output !== undefined ? MergeVideosOutput.safeParse(result.output) : null;

  return (
    <ToolCardShell toolUse={toolUse} result={result} live={live}>
      <div className="space-y-2">
        {input.success && (
          <>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
              {input.data.video_urls.map((url) => (
                <li key={url} className="truncate" title={url}>
                  {url}
                </li>
              ))}
            </ol>
            <Badge variant="outline">transition: {input.data.transition}</Badge>
          </>
        )}
        {output?.success && <video src={output.data.video_url} controls className="max-h-56 w-full rounded" />}
      </div>
    </ToolCardShell>
  );
}
