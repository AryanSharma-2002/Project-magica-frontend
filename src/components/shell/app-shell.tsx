"use client";
import { useEffect, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { SearchCommand } from "@/components/sidebar/search-command";
import { useUiStore } from "@/stores/ui";
import { TopBar } from "./top-bar";

/**
 * Persistent shell: a fixed sidebar on desktop (an 8px-inset card, or a 64px collapsed rail), a
 * Sheet on mobile, a persistent top bar, and the routed page as `main`.
 *
 * `SearchCommand` and the global keyboard shortcuts are mounted here (once) rather than inside
 * `Sidebar`: the desktop `<aside>` stays in the DOM (just `hidden` via CSS) even while the mobile
 * Sheet's own `Sidebar` copy is mounted, so anything with a `window` keydown listener would
 * otherwise double-register and shortcuts would fire twice (open then immediately close).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  return (
    <div className="flex h-svh w-full gap-2 overflow-hidden bg-background">
      {/* Desktop sidebar: an 8px-inset card (FIDELITY.md "Shell"). The wrapper reserves the full
          slot width and insets the card via padding, so the card's right edge sits flush against
          the main column with no extra gap beyond the flex `gap-2` above. */}
      <aside
        className="hidden shrink-0 py-2 pl-2 md:flex"
        style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[16px] border border-border bg-background">
          <Sidebar collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-(--sidebar-width) max-w-[85vw] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>

      <SearchCommand />
    </div>
  );
}
