"use client";
import { useCallback, useMemo, useState } from "react";
import type { Uppy as UppyInstanceType } from "@uppy/core";
import type { Attachment, AppLimits, CreateAssemblyRequest } from "@/contracts";

/** `FileMeta` (the per-file entry of `CreateAssemblyRequest.files`) has no exported type alias in
 * contracts/api.ts — only the request/response types are exported. Derived here rather than hand-edited. */
type FileMeta = CreateAssemblyRequest["files"][number];
import { attachmentsService } from "@/services/attachments";
import {
  composerKey,
  EMPTY_ATTACHMENTS,
  nextAttachmentPosition,
  useComposerStore,
  type PendingAttachment,
} from "@/stores/composer";
import { makeClientId, validateFiles, type ValidationIssue } from "./validation";

type UppyMeta = { clientId: string };
type UppyBody = Record<string, never>;
type UppyInstance = UppyInstanceType<UppyMeta, UppyBody>;

const IN_FLIGHT_ATTACHMENT_STATUSES = new Set<PendingAttachment["status"]>(["queued", "uploading", "processing"]);

/** Bounded backoff for polling attachment readiness after the Transloadit upload completes. */
const POLL_DELAYS_MS = [1000, 1500, 2500, 4000, 6000, 8000, 10000, 15000];

/**
 * Per-clientId bookkeeping that must survive the owning Composer unmounting (chat switch mid-upload):
 * the in-memory File (for retry), which Uppy instance currently owns this clientId (for cancel), and
 * Uppy's *real* internal file id for that upload (see note on `addFile` below). Deliberately
 * module-level, not component refs — an unmount must not kill an in-flight upload.
 */
const filesByClientId = new Map<string, File>();
const uppyByClientId = new Map<string, UppyInstance>();
const uppyFileIdByClientId = new Map<string, string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function revokePreview(url: string | null): void {
  if (!url) return;
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // best-effort; nothing to recover from if the browser already reclaimed it
    }
  }
}

function makePreview(file: File): string | null {
  if (!file.type.startsWith("image/")) return null;
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/**
 * Poll GET /attachments (there is no by-id endpoint) until every id in `attachmentIds` reaches a
 * terminal server status, or the bounded backoff runs out. Runs against the store directly (not
 * component state) so it survives the owning Composer unmounting mid-upload (e.g. chat switch).
 */
async function pollForReady(chatKey: string, attachmentIds: string[]): Promise<void> {
  const remaining = new Set(attachmentIds);
  for (const delay of POLL_DELAYS_MS) {
    if (remaining.size === 0) return;
    await sleep(delay);
    let page;
    try {
      page = await attachmentsService.list({ source: "upload", limit: 50 });
    } catch {
      continue; // transient network error — keep polling within the bounded window
    }
    const byId = new Map(page.items.map((a) => [a.id, a]));
    for (const id of Array.from(remaining)) {
      const att = byId.get(id);
      if (!att) continue;
      if (att.status === "ready" || att.status === "failed" || att.status === "expired") {
        remaining.delete(id);
        useComposerStore.setState((s) => ({
          attachments: {
            ...s.attachments,
            [chatKey]: (s.attachments[chatKey] ?? []).map((a) => {
              if (a.attachmentId !== id) return a;
              const nextPreview = att.previewUrl ?? att.url ?? a.previewUrl;
              if (a.previewUrl?.startsWith("blob:") && nextPreview !== a.previewUrl) revokePreview(a.previewUrl);
              return {
                ...a,
                status: att.status === "ready" ? "ready" : "failed",
                previewUrl: nextPreview,
                error: att.status === "ready" ? null : att.status === "expired" ? "Upload expired." : "Processing failed.",
              };
            }),
          },
        }));
      }
    }
  }
  if (remaining.size > 0) {
    useComposerStore.setState((s) => ({
      attachments: {
        ...s.attachments,
        [chatKey]: (s.attachments[chatKey] ?? []).map((a) =>
          remaining.has(a.attachmentId ?? "")
            ? { ...a, error: a.error ?? "Still processing — you can remove or retry." }
            : a,
        ),
      },
    }));
  }
}

export type UseUploaderResult = {
  attachments: PendingAttachment[];
  issues: ValidationIssue[];
  dismissIssues: () => void;
  hasBlockingAttachments: boolean;
  addFiles: (files: File[] | FileList) => Promise<void>;
  addFromLibrary: (attachment: Attachment) => void;
  cancelFile: (clientId: string) => void;
  cancelAll: () => void;
  retryFile: (clientId: string) => Promise<void>;
  removeAttachment: (clientId: string) => void;
};

export function useUploader(chatId: string | null, limits: AppLimits): UseUploaderResult {
  const chatKey = composerKey(chatId);
  const attachments = useComposerStore((s) => s.attachments[chatKey] ?? EMPTY_ATTACHMENTS);
  const setAttachments = useComposerStore((s) => s.setAttachments);
  const updateAttachment = useComposerStore((s) => s.updateAttachment);
  const removeAttachmentFromStore = useComposerStore((s) => s.removeAttachment);

  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  const dismissIssues = useCallback(() => setIssues([]), []);

  const runBatch = useCallback(
    async (metas: FileMeta[], files: File[]) => {
      let response;
      try {
        response = await attachmentsService.createAssembly({ chatId: chatId ?? undefined, files: metas });
      } catch (err) {
        const failed = new Set(metas.map((m) => m.clientId));
        setAttachments(chatKey, (prev) =>
          prev.map((a) =>
            failed.has(a.clientId)
              ? { ...a, status: "failed", error: err instanceof Error ? err.message : "Failed to start upload." }
              : a,
          ),
        );
        return;
      }

      const attachmentByClientId = new Map(response.attachments.map((a) => [a.clientId, a]));
      setAttachments(chatKey, (prev) =>
        prev.map((a) => {
          const match = attachmentByClientId.get(a.clientId);
          return match ? { ...a, attachmentId: match.id, status: "uploading" as const, error: null } : a;
        }),
      );

      const [{ default: Uppy }, { default: Transloadit }] = await Promise.all([
        import("@uppy/core"),
        import("@uppy/transloadit"),
      ]);

      const uppy: UppyInstance = new Uppy<UppyMeta, UppyBody>({
        autoProceed: false,
        restrictions: { maxFileSize: limits.maxFileBytes, allowedFileTypes: limits.allowedMimeTypes },
      });
      for (const meta of metas) uppyByClientId.set(meta.clientId, uppy);

      let assemblyId: string | null = null;

      /** Ends the whole batch as failed (assembly-level rejection, or nothing left to upload). */
      const failBatch = (message: string) => {
        const ids = new Set(metas.map((m) => m.clientId));
        setAttachments(chatKey, (prev) =>
          prev.map((a) => (ids.has(a.clientId) && IN_FLIGHT_ATTACHMENT_STATUSES.has(a.status) ? { ...a, status: "failed", error: message } : a)),
        );
        for (const meta of metas) if (uppyByClientId.get(meta.clientId) === uppy) uppyByClientId.delete(meta.clientId);
        uppy.destroy();
      };

      uppy.on("upload-progress", (file, progress) => {
        if (!file) return;
        const total = progress.bytesTotal ?? 0;
        const pct = total > 0 ? Math.round((progress.bytesUploaded / total) * 100) : 0;
        updateAttachment(chatKey, file.meta.clientId, { progress: pct });
      });

      uppy.on("upload-success", (file) => {
        if (!file) return;
        updateAttachment(chatKey, file.meta.clientId, { progress: 100, status: "processing" });
      });

      uppy.on("upload-error", (file, error) => {
        if (!file) return;
        updateAttachment(chatKey, file.meta.clientId, { status: "failed", error: error.message || "Upload failed." });
      });

      uppy.on("transloadit:assembly-created", (assembly) => {
        assemblyId = (assembly as { assembly_id?: string }).assembly_id ?? assemblyId;
      });

      // Assembly-level rejection (bad signature, expired params, plan/size limits — see
      // AssemblyStatusErrCode in @transloadit/types). Per-file `upload-error` isn't guaranteed to
      // fire for these, so without this handler the whole batch is stuck "uploading" forever.
      uppy.on("transloadit:assembly-error", (_assembly, error) => {
        failBatch(error.message || "The upload service rejected the request.");
      });

      uppy.use(Transloadit, {
        assemblyOptions: response.assemblyOptions,
        waitForEncoding: false,
        waitForMetadata: true,
        retryDelays: [0, 1000, 3000, 5000],
      });

      let addedCount = 0;
      for (let i = 0; i < metas.length; i += 1) {
        const meta = metas[i];
        const file = files[i];
        if (!meta || !file) continue;
        filesByClientId.set(meta.clientId, file);
        try {
          // NOTE: Uppy's `addFile` ignores any caller-supplied `id` (`#transformFile` always calls
          // `getSafeFileId`, which regenerates one from name/type/size/lastModified — verified in
          // @uppy/core/lib/utils/generateFileID.js). The returned id is the *real* one; `meta`
          // (unlike `id`) is preserved verbatim, so events are correlated by `file.meta.clientId`,
          // and this returned id is kept only for `removeFile`/`retryUpload`. `addFile` also throws
          // synchronously on a duplicate id (e.g. the same file picked twice in one batch) — caught
          // per-file so one bad file doesn't sink the rest of the batch.
          const uppyFileId = uppy.addFile({ name: file.name, type: file.type, data: file, meta: { clientId: meta.clientId } });
          uppyFileIdByClientId.set(meta.clientId, uppyFileId);
          addedCount += 1;
        } catch (err) {
          updateAttachment(chatKey, meta.clientId, { status: "failed", error: err instanceof Error ? err.message : "Couldn't queue this file." });
        }
      }
      if (addedCount === 0) {
        for (const meta of metas) if (uppyByClientId.get(meta.clientId) === uppy) uppyByClientId.delete(meta.clientId);
        uppy.destroy();
        return;
      }

      uppy.on("complete", (result) => {
        void (async () => {
          const successful = result.successful ?? [];
          if (successful.length > 0) {
            const filesPayload = successful
              .map((f) => {
                const match = attachmentByClientId.get(f.meta.clientId);
                if (!match) return null;
                const uploadUrl = f.uploadURL ?? f.response?.uploadURL;
                return uploadUrl ? { attachmentId: match.id, uploadUrl } : { attachmentId: match.id };
              })
              .filter((v): v is { attachmentId: string; uploadUrl?: string } => v !== null);
            if (filesPayload.length > 0) {
              // `uploaded` is a best-effort completion signal; the server's source of truth is the
              // Transloadit notify webhook, which fires (and flips the attachment to ready/failed)
              // independently of whether this call succeeds or `assemblyId` was ever captured — so
              // polling must run either way, not only when this call was attempted.
              if (assemblyId) {
                try {
                  await attachmentsService.uploaded({ assemblyId, files: filesPayload });
                } catch {
                  // best-effort; see comment above
                }
              }
              void pollForReady(
                chatKey,
                filesPayload.map((f) => f.attachmentId),
              );
            }
          }
          for (const meta of metas) {
            // Only clear an entry this batch still owns — a retry started for one of these
            // clientIds (spawning a new Uppy instance + a new real file id) may already have
            // overwritten it, and that newer entry must survive this (older) batch's cleanup.
            if (uppyByClientId.get(meta.clientId) === uppy) uppyByClientId.delete(meta.clientId);
          }
          uppy.destroy();
        })();
      });

      void uppy.upload().catch((err: unknown) => {
        failBatch(err instanceof Error ? err.message : "Upload failed to start.");
      });
    },
    [chatId, chatKey, limits.allowedMimeTypes, limits.maxFileBytes, setAttachments, updateAttachment],
  );

  const addFiles = useCallback(
    async (fileList: File[] | FileList) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const current = useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS;
      // Failed/cancelled attachments don't count against the per-message cap; everything else does.
      const activeCount = current.filter((a) => a.status !== "failed" && a.status !== "cancelled").length;
      const { valid, issues: validationIssues } = validateFiles(files, activeCount, limits);
      if (validationIssues.length > 0) setIssues((prev) => [...prev, ...validationIssues]);
      if (valid.length === 0) return;

      let position = nextAttachmentPosition(current);
      const metas: FileMeta[] = valid.map((file) => ({
        clientId: makeClientId(),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        position: position++,
      }));

      const pending: PendingAttachment[] = metas.map((meta, i) => {
        const file = valid[i];
        return {
          clientId: meta.clientId,
          attachmentId: null,
          filename: meta.filename,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
          position: meta.position,
          progress: 0,
          status: "queued",
          previewUrl: file ? makePreview(file) : null,
          error: null,
        };
      });
      setAttachments(chatKey, (prev) => [...prev, ...pending]);

      await runBatch(metas, valid);
    },
    [chatKey, limits, runBatch, setAttachments],
  );

  const retryFile = useCallback(
    async (clientId: string) => {
      const existing = (useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS).find(
        (a) => a.clientId === clientId,
      );
      const file = filesByClientId.get(clientId);
      if (!existing || !file) return;
      updateAttachment(chatKey, clientId, { status: "uploading", progress: 0, error: null });
      const meta: FileMeta = {
        clientId: existing.clientId,
        filename: existing.filename,
        mimeType: existing.mimeType,
        sizeBytes: existing.sizeBytes,
        position: existing.position,
      };
      await runBatch([meta], [file]);
    },
    [chatKey, runBatch, updateAttachment],
  );

  const cancelFile = useCallback(
    (clientId: string) => {
      const uppy = uppyByClientId.get(clientId);
      const uppyFileId = uppyFileIdByClientId.get(clientId);
      uppy?.removeFile(uppyFileId ?? clientId);
      uppyByClientId.delete(clientId);
      uppyFileIdByClientId.delete(clientId);
      const existing = (useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS).find(
        (a) => a.clientId === clientId,
      );
      revokePreview(existing?.previewUrl ?? null);
      updateAttachment(chatKey, clientId, { status: "cancelled", error: null });
    },
    [chatKey, updateAttachment],
  );

  const cancelAll = useCallback(() => {
    const current = useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS;
    for (const a of current) if (IN_FLIGHT_ATTACHMENT_STATUSES.has(a.status)) cancelFile(a.clientId);
  }, [cancelFile, chatKey]);

  const removeAttachment = useCallback(
    (clientId: string) => {
      const existing = (useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS).find(
        (a) => a.clientId === clientId,
      );
      revokePreview(existing?.previewUrl ?? null);
      filesByClientId.delete(clientId);
      uppyByClientId.delete(clientId);
      uppyFileIdByClientId.delete(clientId);
      removeAttachmentFromStore(chatKey, clientId);
    },
    [chatKey, removeAttachmentFromStore],
  );

  const addFromLibrary = useCallback(
    (attachment: Attachment) => {
      const current = useComposerStore.getState().attachments[chatKey] ?? EMPTY_ATTACHMENTS;
      if (current.some((a) => a.attachmentId === attachment.id)) return;
      const pending: PendingAttachment = {
        clientId: makeClientId(),
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
      setAttachments(chatKey, (prev) => [...prev, pending]);
    },
    [chatKey, setAttachments],
  );

  const hasBlockingAttachments = useMemo(() => attachments.some((a) => IN_FLIGHT_ATTACHMENT_STATUSES.has(a.status)), [attachments]);

  return {
    attachments,
    issues,
    dismissIssues,
    hasBlockingAttachments,
    addFiles,
    addFromLibrary,
    cancelFile,
    cancelAll,
    retryFile,
    removeAttachment,
  };
}
