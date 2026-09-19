"use client";
import type { ReactNode } from "react";
import { PanelLeftIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { useUiStore } from "@/stores/ui";
import { cn } from "cn";

/** Persistent shell: a fixed sidebar on desktop, a Sheet on mobile, and the routed page as `main`. */
export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <aside
        className={cn("hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block")}
        style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-(--sidebar-width) max-w-[85vw] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border p-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}>
            <PanelLeftIcon />
          </Button>
        </div>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
