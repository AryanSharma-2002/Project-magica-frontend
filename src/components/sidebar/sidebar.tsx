"use client";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { PanelLeftIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { ChatList } from "./chat-list";
import { CreditsPill } from "./credits-pill";
import { SearchCommand } from "./search-command";

/**
 * Persistent nav content: new chat, search, chat list, credits, user menu, collapse toggle.
 * `collapsed` renders a compact icon rail (desktop only — the mobile Sheet always passes `false`).
 */
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1.5 py-2">
        <Button variant="ghost" size="icon" aria-label="Expand sidebar" onClick={toggleCollapsed}>
          <PanelLeftIcon />
        </Button>
        <Button asChild variant="secondary" size="icon" aria-label="New chat">
          <Link href="/">
            <PlusIcon />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setCommandPaletteOpen(true)}>
          <SearchIcon />
        </Button>
        <div className="mt-auto pb-1">
          <UserButton />
        </div>
        <SearchCommand />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 p-2">
        <Button asChild variant="secondary" className="flex-1 justify-start gap-2">
          <Link href="/">
            <PlusIcon /> New chat
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={toggleCollapsed} className="hidden md:inline-flex">
          <PanelLeftIcon />
        </Button>
      </div>

      <div className="px-2 pb-2">
        <Button
          variant="outline"
          className="w-full justify-between text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <span className="flex items-center gap-2">
            <SearchIcon className="size-4" /> Search
          </span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.7rem]">⌘K</kbd>
        </Button>
      </div>

      <ChatList />

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border p-2">
        <div className="flex items-center gap-2">
          <UserButton />
        </div>
        <CreditsPill />
      </div>

      <SearchCommand />
    </div>
  );
}
