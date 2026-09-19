"use client";
import { BookOpen, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadSkillOutput, ReadSkillAssetOutput } from "@/contracts";
import { ToolCardShell } from "../ToolCardShell";
import type { ToolCardProps } from "../types";

export function SkillCard({ toolUse, result, live }: ToolCardProps) {
  const isAsset = toolUse.toolName === "read_skill_asset";
  const output = result?.output !== undefined ? (isAsset ? ReadSkillAssetOutput.safeParse(result.output) : LoadSkillOutput.safeParse(result.output)) : null;

  return (
    <ToolCardShell toolUse={toolUse} result={result} live={live}>
      {output?.success && (
        <details className="rounded-md border border-border p-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm">
            {isAsset ? <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" /> : <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            <span>
              {isAsset && "path" in output.data
                ? `Loaded asset ${output.data.path} from ${output.data.name}`
                : "name" in output.data
                  ? `Loaded skill ${output.data.name}`
                  : null}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{output.data.contentHash.slice(0, 8)}</span>
                </TooltipTrigger>
                <TooltipContent>sha256:{output.data.contentHash}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </summary>
          <pre className="mt-1.5 max-h-56 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">
            {"body" in output.data ? output.data.body : output.data.content}
          </pre>
        </details>
      )}
    </ToolCardShell>
  );
}
