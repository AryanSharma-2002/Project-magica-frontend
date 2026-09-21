"use client";
import { ChevronDownIcon } from "lucide-react";
import type { ModelInfo } from "@/contracts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "cn";

const STATUS_META: Record<ModelInfo["status"], { label: string; dot: string }> = {
  available: { label: "Available", dot: "bg-emerald-500" },
  degraded: { label: "Degraded", dot: "bg-amber-500" },
  unavailable: { label: "Unavailable", dot: "bg-red-500" },
  unknown: { label: "Status unknown", dot: "bg-gray-400" },
};

/**
 * Top bar model selector (FIDELITY.md "Shell"): status dot + label + chevron, opening a popover
 * with the model list from `config.models` and the status label. Replaces the composer's status
 * pill (removed by the conversation slice).
 */
export function ModelSelector({ models }: { models: ModelInfo[] }) {
  const current = models[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-[10px] px-2 text-sm text-foreground outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={current ? `Model: ${current.label}, ${STATUS_META[current.status].label}` : "Model"}
        >
          {current ? (
            <>
              <span className={cn("size-2 shrink-0 rounded-full", STATUS_META[current.status].dot)} aria-hidden="true" />
              <span>{current.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Model</span>
          )}
          <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Models</p>
        <ul className="flex flex-col gap-0.5">
          {models.map((model) => {
            const meta = STATUS_META[model.status];
            return (
              <li key={model.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm">
                <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
                <span className="flex-1 truncate">{model.label}</span>
                <span className="text-xs text-muted-foreground">{meta.label}</span>
              </li>
            );
          })}
          {models.length === 0 && <li className="px-1.5 py-1.5 text-sm text-muted-foreground">No models available.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
