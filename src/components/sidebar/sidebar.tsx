"use client";
import { SignOutButton, useClerk, useUser } from "@clerk/nextjs";
import { EllipsisVerticalIcon, LogOutIcon, PanelLeftIcon, SearchIcon } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatList } from "./chat-list";
import { SidebarNav } from "./sidebar-nav";

/** "More" row (FIDELITY.md sidebar contents #4): kebab icon, one real action (sign out) rather
 * than a dead placeholder — the reference's own More menu (settings, theme, etc.) has no
 * equivalent here. */
function MoreMenu({ collapsed = false }: { collapsed?: boolean }) {
  const trigger = collapsed ? (
    <Button variant="ghost" size="icon" aria-label="More" className="size-9 text-muted-foreground">
      <EllipsisVerticalIcon className="size-[18px]" />
    </Button>
  ) : (
    <button
      type="button"
      className="flex h-(--row-height) w-full items-center gap-2.5 rounded-[10px] px-2 text-sm text-foreground outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <EllipsisVerticalIcon className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>More</span>
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "center" : "start"} side={collapsed ? "right" : "top"}>
        <SignOutButton>
          <DropdownMenuItem variant="destructive">
            <LogOutIcon /> Sign out
          </DropdownMenuItem>
        </SignOutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * User card (FIDELITY.md sidebar contents #4): 24px avatar + name, opens the Clerk user profile.
 *
 * Deliberately not `<UserButton showName />`: Clerk injects its own emotion-based styles for
 * `userButtonTrigger`/`userButtonBox` at the same specificity as Tailwind's utility classes but
 * later in the cascade, so `appearance.elements` overrides (avatar size, row direction, name
 * placement) are unreliable — the reference wants avatar-left/name-right at 24px, and emotion's
 * own `row-reverse` + 28px avatar can win instead. A plain button + shadcn `Avatar` is
 * deterministic. Deviation: this opens Clerk's user-profile modal (`openUserProfile`), not the
 * `UserButton` popover menu — sign-out lives in the "More" row instead.
 */
function UserCard({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useUser();
  const clerk = useClerk();
  const name = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account";
  const initial = name.slice(0, 1).toUpperCase();

  const avatar = (
    <Avatar size="sm" className="size-6">
      <AvatarImage src={user?.imageUrl} alt="" />
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Account: ${name}`}
            onClick={() => clerk.openUserProfile()}
            className="flex size-8 items-center justify-center rounded-[10px] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {avatar}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={() => clerk.openUserProfile()}
      className="flex h-(--row-height) w-full items-center gap-2 rounded-[12px] border border-border px-1.5 text-left outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {avatar}
      <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
    </button>
  );
}

/**
 * Persistent nav content: header (wordmark + search + collapse), nav destinations, recent tasks,
 * more, user card. `collapsed` renders a compact 64px icon rail with tooltips (desktop only — the
 * mobile Sheet always passes `false`). Global shortcuts (⌘K, ⌘B) and `SearchCommand` itself live
 * in `AppShell`, not here — see the comment there.
 */
export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  if (collapsed) {
    return (
      <TooltipProvider>
        <div className="flex h-full flex-col items-center gap-1 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Expand sidebar" onClick={toggleCollapsed}>
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar (⌘B)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setCommandPaletteOpen(true)}>
                <SearchIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Search (⌘K)</TooltipContent>
          </Tooltip>

          <div className="my-1 h-px w-6 bg-border" />

          <SidebarNav collapsed />

          <div className="mt-auto flex flex-col items-center gap-1 pb-1">
            <MoreMenu collapsed />
            <UserCard collapsed />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="text-[18px] font-semibold tracking-tight text-foreground">Agent Chat</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search" title="Search (⌘K)" onClick={() => setCommandPaletteOpen(true)}>
            <SearchIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Collapse sidebar" title="Collapse sidebar (⌘B)" onClick={toggleCollapsed}>
            <PanelLeftIcon className="size-4" />
          </Button>
        </div>
      </div>

      <SidebarNav />

      <p className="px-4 pt-4 pb-1 text-xs text-muted-foreground">Recent tasks</p>
      <ChatList />

      <div className="mt-auto flex flex-col gap-1 border-t border-border p-2">
        <MoreMenu />
        <UserCard />
      </div>
    </div>
  );
}
