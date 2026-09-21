"use client";
import { FolderIcon, PanelLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useConfig } from "@/queries/config";
import { useUiStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "./model-selector";
import { CreditsPill } from "./credits-pill";

/**
 * Persistent top bar (FIDELITY.md "Shell"): 52px, model selector at left, files toggle + credits
 * pill at right. Rendered once in `AppShell` — nothing here depends on the active chat.
 *
 * Deviation from the screenshots: `galaxy-reference-empty.jpeg` (no chat yet) hides the files
 * button entirely, while `galaxy-reference-chat.jpeg`/`-tools.jpeg` (an existing chat) show it —
 * gated here on the route rather than "does this chat have any assets", since that would require
 * duplicating the conversation slice's asset-extraction logic at the layout level.
 */
export function TopBar() {
  const pathname = usePathname();
  const isChatRoute = pathname?.startsWith("/chat/") ?? false;

  const { data: config } = useConfig();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const artifactPanelOpen = useUiStore((s) => s.artifactPanelOpen);
  const setArtifactPanelOpen = useUiStore((s) => s.setArtifactPanelOpen);

  return (
    <header className="mt-2 flex h-(--topbar-height) shrink-0 items-center justify-between bg-background py-2 pr-6 pl-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)} className="md:hidden">
          <PanelLeftIcon />
        </Button>
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:inline-flex"
          >
            <PanelLeftIcon />
          </Button>
        )}
        <ModelSelector models={config?.models ?? []} />
      </div>

      <div className="flex items-center gap-2">
        {isChatRoute && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={artifactPanelOpen ? "Close files panel" : "Open files panel"}
            aria-pressed={artifactPanelOpen}
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
          >
            <FolderIcon />
          </Button>
        )}
        <CreditsPill />
      </div>
    </header>
  );
}
