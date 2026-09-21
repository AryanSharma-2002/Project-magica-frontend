/** Shared formatting helpers for tool cards and waitpoint overlays (both display credits/durations). */

/** Integer microcredits -> "0.27 credits" (1 credit = 1,000,000 microcredits; contracts/primitives.ts). */
export function formatCredits(microcredits: number): string {
  const credits = microcredits / 1_000_000;
  const formatted = credits.toFixed(credits < 1 ? 2 : credits < 10 ? 2 : 1).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `${formatted} credit${credits === 1 ? "" : "s"}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainderSeconds}s`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Short input summary for a step row (messages/step-group.tsx) — a compact one-liner, not the
 * full per-tool card summary. Tolerates `input: null` (live-synthesized tool_use blocks haven't
 * been checkpointed yet, ARCHITECTURE §6).
 */
export function summarizeToolInput(toolName: string, input: unknown): string | null {
  if (input == null || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  switch (toolName) {
    case "crop_image":
      return "Crop";
    case "gpt_image_2":
      return typeof record.prompt === "string" ? truncate(record.prompt, 60) : null;
    case "merge_videos":
      return Array.isArray(record.video_urls) ? `${record.video_urls.length} clip${record.video_urls.length === 1 ? "" : "s"}` : null;
    case "load_skill":
    case "read_skill_asset":
      return typeof record.name === "string" ? record.name : null;
    default:
      return null;
  }
}

/** mm:ss (or "Expired") countdown label from an ISO expiry timestamp. */
export function formatCountdown(expiresAt: string, now: number = Date.now()): { label: string; expired: boolean } {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return { label: "Expired", expired: true };
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { label: `${minutes}:${seconds.toString().padStart(2, "0")}`, expired: false };
}
