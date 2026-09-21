"use client";
import type { ToolDescriptor } from "@/contracts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Sidebar "Tools" nav item (FIDELITY.md "Shell"): a small dialog listing `config.tools` labels +
 * descriptions. No per-tool credit/approval detail — that lives in the tool card (conversation slice).
 */
export function ToolsDialog({
  open,
  onOpenChange,
  tools,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: ToolDescriptor[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tools</DialogTitle>
          <DialogDescription>Tools the agent can use while working on a task.</DialogDescription>
        </DialogHeader>
        {tools.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No tools available.</p>
        ) : (
          <ScrollArea className="h-72">
            <ul className="flex flex-col gap-3 pr-3">
              {tools.map((tool) => (
                <li key={tool.name}>
                  <p className="text-sm font-medium text-foreground">{tool.label}</p>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
