"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Images, Loader2, Paperclip, Route, Send, SquareIcon } from "lucide-react";
import type { AppLimits, Attachment, ModelInfo, RunStatus } from "@/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { composerKey, useComposerStore } from "@/stores/composer";
import { AttachmentChip } from "./AttachmentChip";
import { MediaLibraryPicker } from "./MediaLibraryPicker";
import { StatusPill } from "./StatusPill";
import { useUploader } from "./useUploader";

/**
 * Seam between the shell (page composition, F1) and the composer (F2).
 * F2 replaces the implementation; the props are the contract and must not change without both sides.
 */
export type ComposerSendInput = { text: string; attachmentIds: string[]; planMode: boolean };

export type ComposerProps = {
  /** null = new chat; the shell creates the chat on first send. */
  chatId: string | null;
  limits: AppLimits;
  models: ModelInfo[];
  /** Status of the active run for send/stop/interrupt states; null when idle. */
  runStatus: RunStatus | null;
  disabled?: boolean;
  onSend: (input: ComposerSendInput) => Promise<void>;
  onStop: () => Promise<void>;
};

const MAX_TEXTAREA_LINES = 8;
const LINE_HEIGHT_PX = 20;
const TEXTAREA_MAX_HEIGHT_PX = MAX_TEXTAREA_LINES * LINE_HEIGHT_PX + 16;

type ComposerMode = "idle" | "active" | "waiting" | "stopping";

function modeFor(runStatus: RunStatus | null): ComposerMode {
  if (runStatus === "queued" || runStatus === "running") return "active";
  if (runStatus === "waiting") return "waiting";
  if (runStatus === "stopping") return "stopping";
  return "idle";
}

export function Composer({ chatId, limits, models, runStatus, disabled = false, onSend, onStop }: ComposerProps) {
  const chatKey = composerKey(chatId);
  const draft = useComposerStore((s) => s.drafts[chatKey] ?? "");
  const setDraft = useComposerStore((s) => s.setDraft);
  const planMode = useComposerStore((s) => s.planMode);
  const setPlanMode = useComposerStore((s) => s.setPlanMode);
  const clearComposer = useComposerStore((s) => s.clear);

  const uploader = useUploader(chatId, limits);
  const sortedAttachments = useMemo(
    () => [...uploader.attachments].sort((a, b) => a.position - b.position),
    [uploader.attachments],
  );

  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaId = useId();
  const counterId = useId();
  const errorId = useId();

  const serverMode = modeFor(runStatus);
  // Once the server reports the run is no longer active, drop the optimistic "stopping" override
  // (a pure derivation, not an effect, so a stale flag can never survive past the next render).
  const mode: ComposerMode = serverMode === "idle" ? "idle" : stopping ? "stopping" : serverMode;

  const overLimit = draft.length > limits.maxMessageChars;
  const readyAttachmentIds = sortedAttachments
    .filter((a): a is typeof a & { attachmentId: string } => a.status === "ready" && a.attachmentId !== null)
    .map((a) => a.attachmentId);
  const isEmpty = draft.trim().length === 0 && readyAttachmentIds.length === 0;
  const canSend = !disabled && !sending && mode === "idle" && !overLimit && !uploader.hasBlockingAttachments && !isEmpty;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [draft]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSendError(null);
    setSending(true);
    try {
      await onSend({ text: draft.trim(), attachmentIds: readyAttachmentIds, planMode });
      clearComposer(chatKey);
      textareaRef.current?.focus();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send your message. Try again.");
    } finally {
      setSending(false);
    }
  }, [canSend, draft, readyAttachmentIds, planMode, onSend, clearComposer, chatKey]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      await onStop();
    } finally {
      setStopping(false);
    }
  }, [onStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void handleSend();
        return;
      }
      if (e.key === "Escape" && mode === "active") {
        e.preventDefault();
        void handleStop();
      }
    },
    [handleSend, handleStop, mode],
  );

  const addFilesFromList = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files || files.length === 0) return;
      void uploader.addFiles(files);
    },
    [uploader],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      addFilesFromList(e.dataTransfer.files);
    },
    [addFilesFromList],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) addFilesFromList(files);
    },
    [addFilesFromList],
  );

  const handleLibrarySelect = useCallback(
    (attachment: Attachment) => {
      uploader.addFromLibrary(attachment);
    },
    [uploader],
  );

  const uploadStatusMessage = useMemo(() => {
    const uploading = sortedAttachments.filter((a) => a.status === "queued" || a.status === "uploading" || a.status === "processing");
    if (uploading.length > 0) return `Uploading ${uploading.length} attachment${uploading.length === 1 ? "" : "s"}…`;
    const failed = sortedAttachments.filter((a) => a.status === "failed");
    if (failed.length > 0) return `${failed.length} attachment${failed.length === 1 ? "" : "s"} failed to upload.`;
    return "";
  }, [sortedAttachments]);

  return (
    <TooltipProvider>
      <div
        className="border-t bg-background p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        data-testid="composer-root"
      >
        <div aria-live="polite" className="sr-only">
          {uploadStatusMessage}
        </div>

        {uploader.issues.length > 0 && (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>
              <ul className="list-inside list-disc">
                {uploader.issues.map((issue, i) => (
                  <li key={`${issue.fileName}-${i}`}>{issue.message}</li>
                ))}
              </ul>
              <Button type="button" variant="ghost" size="xs" className="mt-1" onClick={uploader.dismissIssues}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {sendError && (
          <Alert variant="destructive" className="mb-2" id={errorId}>
            <AlertDescription>{sendError}</AlertDescription>
          </Alert>
        )}

        {sortedAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {sortedAttachments.map((a) => (
              <AttachmentChip key={a.clientId} attachment={a} onRemove={uploader.removeAttachment} onRetry={uploader.retryFile} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <label htmlFor={textareaId} className="sr-only">
            Message
          </label>
          <Textarea
            ref={textareaRef}
            id={textareaId}
            value={draft}
            onChange={(e) => setDraft(chatKey, e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Send a message…"
            disabled={disabled}
            className="flex-1 resize-none overflow-y-auto"
            style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
            aria-describedby={`${counterId}${sendError ? ` ${errorId}` : ""}`}
            aria-invalid={overLimit || undefined}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={limits.allowedMimeTypes.join(",")}
              onChange={(e) => {
                addFilesFromList(e.target.files);
                e.target.value = "";
              }}
              aria-label="Attach files"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach files"
                >
                  <Paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach files</TooltipContent>
            </Tooltip>

            <MediaLibraryPicker
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Choose from your media">
                  <Images className="size-4" />
                </Button>
              }
              onSelect={handleLibrarySelect}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={planMode ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-pressed={planMode}
                  aria-label="Plan mode"
                  onClick={() => setPlanMode(!planMode)}
                >
                  <Route className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Plan mode: ask for your approval before tools run.</TooltipContent>
            </Tooltip>

            <StatusPill model={models[0]} />
          </div>

          <div className="flex items-center gap-2">
            <span id={counterId} className={cn("text-xs tabular-nums text-muted-foreground", overLimit && "font-medium text-destructive")}>
              {draft.length}/{limits.maxMessageChars}
            </span>
            {mode === "waiting" && (
              <span role="status" className="text-xs text-muted-foreground">
                Waiting for your decision
              </span>
            )}
            {mode === "active" || mode === "stopping" ? (
              <Button type="button" variant="destructive" onClick={() => void handleStop()} disabled={mode === "stopping"}>
                {mode === "stopping" ? <Loader2 className="size-4 animate-spin" /> : <SquareIcon className="size-4" />}
                {mode === "stopping" ? "Stopping…" : "Stop"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleSend()} disabled={!canSend}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send
              </Button>
            )}
          </div>
        </div>

        {overLimit && (
          <p className="mt-1 text-xs text-destructive">
            Your message is {draft.length - limits.maxMessageChars} characters over the {limits.maxMessageChars} limit.
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">Community plan: uploads may be watermarked or trimmed.</p>
      </div>
    </TooltipProvider>
  );
}

