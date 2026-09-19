import type { AppLimits } from "@/contracts";

export type ValidationIssue = { fileName: string; message: string };

/** Human-readable byte size, e.g. "12.3 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = units[unitIndex] ?? "TB";
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

/**
 * Client-side pre-validation against backend-owned limits, before any network request.
 * Files that fail are reported individually so valid files in the same batch still upload.
 */
export function validateFiles(
  files: File[],
  existingActiveCount: number,
  limits: AppLimits,
): { valid: File[]; issues: ValidationIssue[] } {
  const valid: File[] = [];
  const issues: ValidationIssue[] = [];
  let count = existingActiveCount;

  for (const file of files) {
    if (count >= limits.maxAttachmentsPerMessage) {
      issues.push({ fileName: file.name, message: `You can attach up to ${limits.maxAttachmentsPerMessage} files per message.` });
      continue;
    }
    const mimeType = file.type || "application/octet-stream";
    if (limits.allowedMimeTypes.length > 0 && !limits.allowedMimeTypes.includes(mimeType)) {
      issues.push({ fileName: file.name, message: `"${file.name}" is a ${mimeType} file, which isn't supported here.` });
      continue;
    }
    if (file.size > limits.maxFileBytes) {
      issues.push({ fileName: file.name, message: `"${file.name}" is ${formatBytes(file.size)}, which is over the ${formatBytes(limits.maxFileBytes)} limit.` });
      continue;
    }
    if (file.size <= 0) {
      issues.push({ fileName: file.name, message: `"${file.name}" is empty.` });
      continue;
    }
    valid.push(file);
    count += 1;
  }

  return { valid, issues };
}

let clientIdCounter = 0;

/** Opaque per-file id the client controls end-to-end (Uppy file id, assembly FileMeta, PendingAttachment). */
export function makeClientId(): string {
  clientIdCounter += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `att_${Date.now()}_${clientIdCounter}_${Math.random().toString(36).slice(2, 8)}`;
}
