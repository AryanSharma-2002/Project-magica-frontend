import type { z } from "zod";
import type {
  AssetBlock,
  ContentBlock,
  LiveToolState,
  RunMetadata,
  RunStatus,
  SafeError,
  TextBlock,
  TextChunk,
  ThinkingBlock,
} from "@/contracts";
import { LiveWaitpoint as LiveWaitpointSchema } from "@/contracts";

// NOTE: `@/contracts/realtime.ts` exports the `LiveWaitpoint` Zod schema but not its inferred
// type (every sibling type in that file does). Derived locally rather than editing the
// (read-only) vendored contract; see the final report for the proposed one-line fix upstream.
type LiveWaitpoint = z.infer<typeof LiveWaitpointSchema>;

/**
 * Pure reducer: Trigger run metadata + agent-text chunks + the persisted (checkpointed) content
 * array -> the blocks to render while a run is active. See ARCHITECTURE §6 (reconciliation rule):
 * this is only consulted while the run is non-terminal; on terminal status the caller switches to
 * rendering `persisted` directly.
 *
 * Fully deterministic given its inputs: replaying the same `chunks` array from scratch (e.g. after
 * a reconnect with `startIndex: 0`) always yields the same `blocks`.
 */

export type LiveView = {
  blocks: ContentBlock[];
  status: RunStatus | null;
  step: string | null;
  progress: number | null;
  thinkingMs: number | null;
  tools: Record<string, LiveToolState>;
  waitpoint: LiveWaitpoint | null;
  error: SafeError | null;
};

export type BuildLiveViewInput = {
  metadata: RunMetadata | null;
  chunks: TextChunk[];
  persisted: ContentBlock[];
};

const EMPTY_TOOLS: Record<string, LiveToolState> = {};
const TERMINAL_TOOL_STATUSES = new Set<LiveToolState["status"]>(["completed", "failed", "cancelled"]);

function isToolResultStatus(status: LiveToolState["status"]): status is "completed" | "failed" | "cancelled" {
  return TERMINAL_TOOL_STATUSES.has(status);
}

export function buildLiveView({ metadata, chunks, persisted }: BuildLiveViewInput): LiveView {
  const blocksByIndex = new Map<number, ContentBlock>();

  // 1. text / thinking: concatenate deltas per block index, in the order the stream delivered them.
  const buffers = new Map<number, { t: TextChunk["t"]; text: string }>();
  for (const chunk of chunks) {
    const existing = buffers.get(chunk.i);
    if (existing) {
      existing.text += chunk.d;
    } else {
      buffers.set(chunk.i, { t: chunk.t, text: chunk.d });
    }
  }
  for (const [index, buf] of buffers) {
    const block: TextBlock | ThinkingBlock =
      buf.t === "text" ? { type: "text", text: buf.text } : { type: "thinking", text: buf.text };
    blocksByIndex.set(index, block);
  }

  const tools = metadata?.tools ?? EMPTY_TOOLS;

  // 2. tool_use blocks synthesized from live tool state, at the block's own index.
  //    Input is not carried in live metadata; prefer the persisted block's input if it has
  //    already been checkpointed at that index, otherwise null.
  for (const [toolCallId, state] of Object.entries(tools)) {
    const persistedAtIndex = persisted[state.index];
    const input = persistedAtIndex?.type === "tool_use" ? persistedAtIndex.input : null;
    blocksByIndex.set(state.index, {
      type: "tool_use",
      toolCallId,
      invocationId: state.invocationId,
      toolName: state.toolName,
      input,
    });
  }

  // 3. assets, at their own index.
  for (const asset of metadata?.assets ?? []) {
    const { index, ...rest } = asset;
    blocksByIndex.set(index, rest as AssetBlock);
  }

  // 4. reasoning narration, at its own index.
  for (const r of metadata?.reasoning ?? []) {
    blocksByIndex.set(r.index, { type: "reasoning", text: r.text });
  }

  const liveIndices = [...blocksByIndex.keys()];
  const maxLiveIndex = liveIndices.length ? Math.max(...liveIndices) : -1;
  const maxIndex = Math.max(maxLiveIndex, persisted.length - 1);

  const blocks: ContentBlock[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    const live = blocksByIndex.get(i);
    if (live) {
      blocks.push(live);
      continue;
    }
    // Persisted fallback: the live view has nothing for this index yet (or never will, e.g. a
    // citation/usage block that only ever exists once checkpointed).
    const fromPersisted = persisted[i];
    if (fromPersisted) blocks.push(fromPersisted);
  }

  // 5. terminal tool_result synthesis: only when the persisted content hasn't already checkpointed
  //    a tool_result for this call (avoids a duplicate once persistence catches up).
  const existingResultToolCallIds = new Set(
    blocks.filter((b) => b.type === "tool_result").map((b) => (b.type === "tool_result" ? b.toolCallId : "")),
  );
  const synthesizedResults: ContentBlock[] = Object.entries(tools)
    .filter(([toolCallId, state]) => isToolResultStatus(state.status) && !existingResultToolCallIds.has(toolCallId))
    .sort((a, b) => a[1].index - b[1].index)
    .map(([toolCallId, state]) => ({
      type: "tool_result" as const,
      toolCallId,
      invocationId: state.invocationId,
      toolName: state.toolName,
      status: state.status as "completed" | "failed" | "cancelled",
      error: state.error ?? undefined,
      microcredits: state.microcredits,
      durationMs:
        state.startedAt && state.finishedAt
          ? Math.max(0, new Date(state.finishedAt).getTime() - new Date(state.startedAt).getTime())
          : undefined,
    }));

  return {
    blocks: [...blocks, ...synthesizedResults],
    status: metadata?.status ?? null,
    step: metadata?.step ?? null,
    progress: metadata?.progress ?? null,
    thinkingMs: metadata?.thinkingMs ?? null,
    tools,
    waitpoint: metadata?.waitpoint ?? null,
    error: metadata?.error ?? null,
  };
}
