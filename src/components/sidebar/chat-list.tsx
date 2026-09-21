"use client";
import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useChats } from "@/queries/chats";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatListItem } from "./chat-list-item";

/** Exported so `SidebarNav` (the Library entry point) can target the composer draft for the
 * chat currently in view without duplicating this regex. */
export function activeChatId(pathname: string): string | null {
  const match = /^\/chat\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

export function ChatList() {
  const pathname = usePathname();
  const activeId = activeChatId(pathname);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useChats({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const chats = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const pinned = chats.filter((c) => c.pinned);
  const others = chats.filter((c) => !c.pinned);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-(--row-height) w-full rounded-[10px]" />
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return <p className="min-h-0 flex-1 px-4 py-2 text-sm text-muted-foreground">No tasks yet.</p>;
  }

  return (
    <nav aria-label="Recent tasks" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2">
      {pinned.length > 0 ? (
        <div>
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Pinned</p>
          <div className="flex flex-col gap-0.5">
            {pinned.map((chat) => (
              <ChatListItem key={chat.id} chat={chat} active={chat.id === activeId} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {others.map((chat) => (
          <ChatListItem key={chat.id} chat={chat} active={chat.id === activeId} />
        ))}
      </div>
      <div ref={sentinelRef} />
    </nav>
  );
}
