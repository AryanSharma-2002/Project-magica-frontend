"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BlocksIcon, BookOpenIcon, CirclePlusIcon, ImagesIcon, LifeBuoyIcon, MessageSquareIcon } from "lucide-react";
import type { Attachment } from "@/contracts";
import { env } from "@/lib/env";
import { useConfig } from "@/queries/config";
import { composerKey, nextAttachmentPosition, useComposerStore, EMPTY_ATTACHMENTS, type PendingAttachment } from "@/stores/composer";
import { MediaLibraryPicker } from "@/components/composer/MediaLibraryPicker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeChatId } from "./chat-list";
import { ToolsDialog } from "@/components/shell/tools-dialog";

/** Falls back to the hosted API health endpoint when `NEXT_PUBLIC_DOCS_URL` is unset. */
const DOCS_FALLBACK_URL = "https://agent-chat-backend-tan.vercel.app/api/v1/health";

/**
 * Add a media-library selection to the current chat's composer attachments. Mirrors
 * `useUploader().addFromLibrary` (composer/useUploader.ts) — a trivial store write, not a call
 * into Uppy — so the sidebar's Library entry point doesn't need the composer's upload machinery.
 */
function addLibraryAttachmentToComposer(chatKey: string, attachment: Attachment): void {
  const current = useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS;
  if (current.some((a) => a.attachmentId === attachment.id)) return;
  const pending: PendingAttachment = {
    clientId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `lib_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    attachmentId: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    position: nextAttachmentPosition(current),
    progress: 100,
    status: attachment.status === "ready" ? "ready" : "processing",
    previewUrl: attachment.previewUrl ?? attachment.url,
    error: null,
  };
  useComposerStore.getState().setAttachments(chatKey, (prev) => [...prev, pending]);
}

const expandedRowClass =
  "flex h-(--row-height) items-center gap-2.5 rounded-[10px] px-2 text-sm text-foreground outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/50";
const collapsedRowClass =
  "flex size-8 items-center justify-center rounded-[10px] text-muted-foreground outline-none hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

function withTooltip(collapsed: boolean, label: string, node: ReactNode): ReactNode {
  if (!collapsed) return node;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Nav destinations (FIDELITY.md "Shell", sidebar contents #2): New task, Tasks, Library, Tools,
 * API / MCP, Help & Support. Deliberately Clerk-free so it can be unit tested without mocking
 * `@clerk/nextjs` — the user card lives in `Sidebar` instead.
 */
export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const { data: config } = useConfig();
  const pathname = usePathname();
  const chatKey = composerKey(activeChatId(pathname ?? ""));

  const docsUrl = env.NEXT_PUBLIC_DOCS_URL ?? DOCS_FALLBACK_URL;
  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL;

  const rowClass = collapsed ? collapsedRowClass : expandedRowClass;
  const iconClass = collapsed ? "size-[18px]" : "size-[18px] shrink-0 text-muted-foreground";

  return (
    <nav aria-label="Main" className={collapsed ? "flex flex-col items-center gap-1" : "flex flex-col gap-0.5 px-2 py-2"}>
      {withTooltip(
        collapsed,
        "New task",
        <Link href="/" className={rowClass} aria-label={collapsed ? "New task" : undefined}>
          <CirclePlusIcon className={iconClass} aria-hidden="true" />
          {!collapsed && <span className="truncate">New task</span>}
        </Link>,
      )}

      {withTooltip(
        collapsed,
        "Tasks",
        <Link href="/" className={rowClass} aria-label={collapsed ? "Tasks" : undefined}>
          <MessageSquareIcon className={iconClass} aria-hidden="true" />
          {!collapsed && <span className="truncate">Tasks</span>}
        </Link>,
      )}

      {withTooltip(
        collapsed,
        "Library",
        <MediaLibraryPicker
          trigger={
            <button type="button" className={rowClass} aria-label={collapsed ? "Library" : undefined}>
              <ImagesIcon className={iconClass} aria-hidden="true" />
              {!collapsed && <span className="truncate">Library</span>}
            </button>
          }
          onSelect={(attachment) => addLibraryAttachmentToComposer(chatKey, attachment)}
        />,
      )}

      {withTooltip(
        collapsed,
        "Tools",
        <button type="button" className={rowClass} aria-label={collapsed ? "Tools" : undefined} onClick={() => setToolsOpen(true)}>
          <BlocksIcon className={iconClass} aria-hidden="true" />
          {!collapsed && <span className="truncate">Tools</span>}
        </button>,
      )}

      {withTooltip(
        collapsed,
        "API / MCP",
        <a href={docsUrl} target="_blank" rel="noreferrer" className={rowClass} aria-label={collapsed ? "API / MCP" : undefined}>
          <BookOpenIcon className={iconClass} aria-hidden="true" />
          {!collapsed && <span className="truncate">API / MCP</span>}
        </a>,
      )}

      {/* "fallback hidden" (FIDELITY.md): no NEXT_PUBLIC_SUPPORT_EMAIL, no nav item — not a disabled one. */}
      {supportEmail &&
        withTooltip(
          collapsed,
          "Help & Support",
          <a href={`mailto:${supportEmail}`} className={rowClass} aria-label={collapsed ? "Help & Support" : undefined}>
            <LifeBuoyIcon className={iconClass} aria-hidden="true" />
            {!collapsed && <span className="truncate">Help &amp; Support</span>}
          </a>,
        )}

      <ToolsDialog open={toolsOpen} onOpenChange={setToolsOpen} tools={config?.tools ?? []} />
    </nav>
  );
}
