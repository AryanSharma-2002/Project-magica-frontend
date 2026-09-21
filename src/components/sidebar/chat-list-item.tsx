"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontalIcon, PinIcon, PinOffIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { Chat } from "@/contracts";
import { useDeleteChat, useUpdateChat } from "@/queries/chats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "cn";

export function ChatListItem({ chat, active }: { chat: Chat; active: boolean }) {
  const router = useRouter();
  const updateChat = useUpdateChat(chat.id);
  const deleteChat = useDeleteChat();
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitRename = () => {
    const title = draftTitle.trim();
    setRenaming(false);
    if (!title || title === chat.title) return;
    updateChat.mutate({ title }, { onError: () => toast.error("Couldn't rename this chat") });
  };

  const togglePin = () => {
    updateChat.mutate({ pinned: !chat.pinned }, { onError: () => toast.error("Couldn't update this chat") });
  };

  const confirmDelete = () => {
    deleteChat.mutate(chat.id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        if (active) router.push("/");
      },
      onError: () => toast.error("Couldn't delete this chat"),
    });
  };

  if (renaming) {
    return (
      <div className="px-2 py-1">
        <Input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setDraftTitle(chat.title);
              setRenaming(false);
            }
          }}
          aria-label="Rename chat"
          className="h-8"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/item relative flex h-(--row-height) items-center rounded-[10px]",
        active ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]",
      )}
    >
      <Link
        href={`/chat/${chat.id}`}
        aria-current={active ? "page" : undefined}
        className="min-w-0 flex-1 truncate px-2 text-sm"
        title={chat.title}
      >
        {chat.title || "New task"}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${chat.title || "New task"}`}
            className="mr-1 size-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={togglePin}>
            {chat.pinned ? <PinOffIcon /> : <PinIcon />}
            {chat.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDraftTitle(chat.title);
              setRenaming(true);
            }}
          >
            <PencilIcon /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              &ldquo;{chat.title || "New task"}&rdquo; and its messages will be removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteChat.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
