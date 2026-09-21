"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareIcon } from "lucide-react";
import { useUiStore } from "@/stores/ui";
import { useSearch } from "@/queries/search";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/** Global ⌘K / Ctrl+K command palette: search over chat titles + message text, navigate on select. */
export function SearchCommand() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const { data, isFetching } = useSearch(query, { enabled: open });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  // Clear the query once the palette closes. Adjusted during render (React's documented pattern
  // for resetting state on a prop change) rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  const hits = data?.items ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search your tasks">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search tasks and messages…" value={query} onValueChange={setQuery} />
        <CommandList>
          {query.trim().length === 0 ? (
            <CommandEmpty>Type to search your tasks.</CommandEmpty>
          ) : isFetching && hits.length === 0 ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : hits.length === 0 ? (
            <CommandEmpty>No results.</CommandEmpty>
          ) : (
            <CommandGroup heading="Tasks">
              {hits.map((hit) => (
                <CommandItem
                  key={`${hit.chatId}:${hit.messageId ?? "title"}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/chat/${hit.chatId}`);
                  }}
                >
                  <MessageSquareIcon />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{hit.chatTitle || "New task"}</span>
                    {hit.snippet ? <span className="truncate text-xs text-muted-foreground">{hit.snippet}</span> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
