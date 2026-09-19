"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const filesRef = useRef(new Map<string, File>());
  const uppyByClientRef = useRef(new Map<string, UppyInstance>());
  const allUppyRef = useRef(new Set<UppyInstance>());

  useEffect(
    () => () => {
      for (const uppy of allUppyRef.current) uppy.destroy();
      allUppyRef.current.clear();
      uppyByClientRef.current.clear();
    },
    [],
  );

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
      allUppyRef.current.add(uppy);
      for (const meta of metas) uppyByClientRef.current.set(meta.clientId, uppy);

      let assemblyId: string | null = null;

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

      uppy.use(Transloadit, {
        assemblyOptions: response.assemblyOptions,
        waitForEncoding: false,
        waitForMetadata: true,
        retryDelays: [0, 1000, 3000, 5000],
      });

      for (let i = 0; i < metas.length; i += 1) {
        const meta = metas[i];
        const file = files[i];
        if (!meta || !file) continue;
        filesRef.current.set(meta.clientId, file);
        uppy.addFile({ id: meta.clientId, name: file.name, type: file.type, data: file, meta: { clientId: meta.clientId } });
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
            if (filesPayload.length > 0 && assemblyId) {
              try {
                await attachmentsService.uploaded({ assemblyId, files: filesPayload });
              } catch {
                // The assembly still completed on Transloadit's side; keep polling — the server
                // reconciles from the notify webhook independently of this best-effort call.
              }
              void pollForReady(
                chatKey,
                filesPayload.map((f) => f.attachmentId),
              );
            }
          }
          for (const meta of metas) uppyByClientRef.current.delete(meta.clientId);
          allUppyRef.current.delete(uppy);
          uppy.destroy();
        })();
      });

      uppy.upload();
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
      const file = filesRef.current.get(clientId);
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
      const uppy = uppyByClientRef.current.get(clientId);
      uppy?.removeFile(clientId);
      uppyByClientRef.current.delete(clientId);
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
      filesRef.current.delete(clientId);
      uppyByClientRef.current.delete(clientId);
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
