import { describe, expect, it } from "vitest";
import type { ContentBlock, LiveToolState, RunMetadata, TextChunk } from "@/contracts";
import { buildLiveView } from "./liveView";

function metadata(over: Partial<RunMetadata> = {}): RunMetadata {
  return {
    v: 1,
    runId: "run_1",
    chatId: "chat_1",
    assistantMessageId: "msg_assistant",
    status: "running",
    step: "Thinking",
    progress: null,
    thinkingStartedAt: null,
    thinkingMs: null,
    routedModel: null,
    tools: {},
    waitpoint: null,
    assets: [],
    reasoning: [],
    error: null,
    persistedUpTo: -1,
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...over,
  };
}

function toolState(over: Partial<LiveToolState> = {}): LiveToolState {
  return {
    invocationId: "inv_1",
    toolName: "crop_image",
    status: "running",
    index: 1,
    startedAt: "2026-09-19T00:00:00.000Z",
    finishedAt: null,
    providerRunId: null,
    error: null,
    ...over,
  };
}

describe("buildLiveView", () => {
  it("assembles a thinking block from chunk concatenation", () => {
    const chunks: TextChunk[] = [
      { t: "thinking", i: 0, d: "Let me " },
      { t: "thinking", i: 0, d: "think..." },
    ];
    const view = buildLiveView({ metadata: metadata(), chunks, persisted: [] });
    expect(view.blocks).toEqual([{ type: "thinking", text: "Let me think..." }]);
  });

  it("interleaves text, tool_use, and asset blocks ordered by index", () => {
    const chunks: TextChunk[] = [
      { t: "text", i: 0, d: "Cropping " },
      { t: "text", i: 0, d: "your image." },
      { t: "text", i: 2, d: "Done!" },
    ];
    const meta = metadata({
      tools: { call_1: toolState({ index: 1, status: "running" }) },
      assets: [{ type: "asset", kind: "image", url: "https://x/img.png", index: 3 }],
    });
    const view = buildLiveView({ metadata: meta, chunks, persisted: [] });
    expect(view.blocks.map((b) => b.type)).toEqual(["text", "tool_use", "text", "asset"]);
    expect(view.blocks[0]).toEqual({ type: "text", text: "Cropping your image." });
    expect(view.blocks[1]).toMatchObject({ type: "tool_use", toolCallId: "call_1", toolName: "crop_image" });
    expect(view.blocks[3]).toMatchObject({ type: "asset", url: "https://x/img.png" });
  });

  it("is pure: replaying the same chunks from index 0 yields identical blocks", () => {
    const chunks: TextChunk[] = [
      { t: "text", i: 0, d: "Hello" },
      { t: "text", i: 0, d: " world" },
    ];
    const meta = metadata({ tools: { call_1: toolState({ index: 1 }) } });
    const first = buildLiveView({ metadata: meta, chunks, persisted: [] });
    const replay = buildLiveView({ metadata: meta, chunks: [...chunks], persisted: [] });
    expect(replay.blocks).toEqual(first.blocks);
  });

  it("falls back to the persisted block when live data has nothing at that index", () => {
    const persisted: ContentBlock[] = [
      { type: "text", text: "already checkpointed" },
      { type: "usage", model: "m", requestedModel: "m", promptTokens: 1, completionTokens: 1, totalTokens: 2, microcredits: 0 },
    ];
    const view = buildLiveView({ metadata: metadata(), chunks: [], persisted });
    expect(view.blocks).toEqual(persisted);
  });

  it("prefers live text over a stale persisted block at the same index", () => {
    const persisted: ContentBlock[] = [{ type: "text", text: "stale" }];
    const chunks: TextChunk[] = [{ t: "text", i: 0, d: "fresh" }];
    const view = buildLiveView({ metadata: metadata(), chunks, persisted });
    expect(view.blocks).toEqual([{ type: "text", text: "fresh" }]);
  });

  it("synthesizes a tool_result once a tool reaches a terminal state", () => {
    const meta = metadata({
      tools: {
        call_1: toolState({
          index: 0,
          status: "completed",
          startedAt: "2026-09-19T00:00:00.000Z",
          finishedAt: "2026-09-19T00:00:02.000Z",
          microcredits: 5000,
        }),
      },
    });
    const view = buildLiveView({ metadata: meta, chunks: [], persisted: [] });
    const result = view.blocks.find((b) => b.type === "tool_result");
    expect(result).toMatchObject({ type: "tool_result", toolCallId: "call_1", status: "completed", microcredits: 5000, durationMs: 2000 });
  });

  it("does not duplicate a tool_result already present in the persisted content", () => {
    const persisted: ContentBlock[] = [
      { type: "tool_use", toolCallId: "call_1", invocationId: "inv_1", toolName: "crop_image", input: {} },
      { type: "tool_result", toolCallId: "call_1", invocationId: "inv_1", toolName: "crop_image", status: "completed" },
    ];
    const meta = metadata({ tools: { call_1: toolState({ index: 0, status: "completed" }) } });
    const view = buildLiveView({ metadata: meta, chunks: [], persisted });
    const results = view.blocks.filter((b) => b.type === "tool_result");
    expect(results).toHaveLength(1);
  });

  it("carries status/step/waitpoint/error through from metadata", () => {
    const meta = metadata({ status: "waiting", step: "Awaiting approval", waitpoint: { id: "wp_1", type: "approval", status: "pending", expiresAt: "2026-09-19T00:10:00.000Z" } });
    const view = buildLiveView({ metadata: meta, chunks: [], persisted: [] });
    expect(view.status).toBe("waiting");
    expect(view.step).toBe("Awaiting approval");
    expect(view.waitpoint?.id).toBe("wp_1");
  });

  it("returns an empty, idle view when metadata is null", () => {
    const view = buildLiveView({ metadata: null, chunks: [], persisted: [] });
    expect(view).toMatchObject({ blocks: [], status: null, step: null, tools: {}, waitpoint: null, error: null });
  });
});
