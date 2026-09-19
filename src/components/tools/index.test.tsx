import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { LiveToolState, ToolResultBlock, ToolUseBlock } from "@/contracts";
import { ToolCard, type ToolCardProps } from "./index";

function renderCard(props: ToolCardProps) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToolCard {...props} />
    </QueryClientProvider>,
  );
}

function toolUse(toolName: string, input: unknown): ToolUseBlock {
  return { type: "tool_use", toolCallId: "call_1", invocationId: "inv_1", toolName, input: input as ToolUseBlock["input"] };
}

function completedResult(toolName: string, output: unknown, overrides: Partial<ToolResultBlock> = {}): ToolResultBlock {
  return {
    type: "tool_result",
    toolCallId: "call_1",
    invocationId: "inv_1",
    toolName,
    status: "completed",
    output: output as ToolResultBlock["output"],
    durationMs: 1200,
    microcredits: 270_000,
    ...overrides,
  };
}

describe("ToolCard", () => {
  it("renders a completed crop_image card with source and result", () => {
    renderCard({
      toolUse: toolUse("crop_image", { image_url: "https://x.test/a.png", crop: { x: 10, y: 10, width: 50, height: 50 } }),
      result: completedResult("crop_image", { image_url: "https://x.test/cropped.png" }),
      live: null,
    });
    expect(screen.getByText("Crop image")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("0.27 credits")).toBeInTheDocument();
    expect(screen.getByAltText("Source image")).toHaveAttribute("src", "https://x.test/a.png");
    expect(screen.getByRole("button", { name: /open cropped image/i })).toBeInTheDocument();
  });

  it("renders a completed gpt_image_2 card with prompt, chips, and an openable image grid", async () => {
    const onOpenAsset = (await import("vitest")).vi.fn();
    renderCard({
      toolUse: toolUse("gpt_image_2", { prompt: "a red fox", size: "1024x1024", quality: "High", background: "Auto", n: 1, output_format: "PNG" }),
      result: completedResult("gpt_image_2", { images: ["https://x.test/1.png"] }),
      live: null,
      onOpenAsset,
    });
    expect(screen.getByText("Generate image")).toBeInTheDocument();
    expect(screen.getByText("a red fox")).toBeInTheDocument();
    expect(screen.getByText("1024x1024")).toBeInTheDocument();
    const openButton = screen.getByRole("button", { name: /open generated image 1/i });
    openButton.click();
    expect(onOpenAsset).toHaveBeenCalledWith("https://x.test/1.png");
  });

  it("renders a completed merge_videos card with the ordered clip list and result player", () => {
    renderCard({
      toolUse: toolUse("merge_videos", { video_urls: ["https://x.test/a.mp4", "https://x.test/b.mp4"], transition: "fade" }),
      result: completedResult("merge_videos", { video_url: "https://x.test/merged.mp4" }),
      live: null,
    });
    expect(screen.getByText("Merge videos")).toBeInTheDocument();
    expect(screen.getByText("transition: fade")).toBeInTheDocument();
    expect(screen.getByText("https://x.test/a.mp4")).toBeInTheDocument();
  });

  it("renders a completed load_skill card with a compact row and expandable body", () => {
    renderCard({
      toolUse: toolUse("load_skill", { name: "image-generation" }),
      result: completedResult("load_skill", { name: "image-generation", contentHash: "a".repeat(64), body: "Skill instructions…", assets: [] }),
      live: null,
    });
    expect(screen.getByText("Loaded skill image-generation")).toBeInTheDocument();
    expect(screen.getByText("Skill instructions…")).toBeInTheDocument();
  });

  it("renders a completed read_skill_asset card", () => {
    renderCard({
      toolUse: toolUse("read_skill_asset", { name: "image-generation", path: "notes.md" }),
      result: completedResult("read_skill_asset", { name: "image-generation", path: "notes.md", contentHash: "b".repeat(64), mimeType: "text/markdown", content: "Notes body" }),
      live: null,
    });
    expect(screen.getByText("Loaded asset notes.md from image-generation")).toBeInTheDocument();
    expect(screen.getByText("Notes body")).toBeInTheDocument();
  });

  it("shows a user-safe error message and code when a tool call fails", () => {
    renderCard({
      toolUse: toolUse("crop_image", { image_url: "https://x.test/a.png", crop: { x: 0, y: 0, width: 10, height: 10 } }),
      result: {
        type: "tool_result",
        toolCallId: "call_1",
        invocationId: "inv_1",
        toolName: "crop_image",
        status: "failed",
        error: { code: "provider_error", message: "Media provider rejected the request", retryable: false },
      },
      live: null,
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Media provider rejected the request")).toBeInTheDocument();
    expect(screen.getByText(/provider_error/)).toBeInTheDocument();
  });

  it("shows a running state with a spinner and no result yet", () => {
    const live: LiveToolState = {
      invocationId: "inv_1",
      toolName: "crop_image",
      status: "running",
      index: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      providerRunId: "prov_123",
      error: null,
    };
    renderCard({ toolUse: toolUse("crop_image", { image_url: "https://x.test/a.png", crop: { x: 0, y: 0, width: 10, height: 10 } }), result: null, live });
    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    expect(screen.getByText(/prov_123/)).toBeInTheDocument();
  });

  it("falls back to the default JSON card for an unknown tool name", () => {
    renderCard({ toolUse: toolUse("some_future_tool", { foo: "bar" }), result: completedResult("some_future_tool", { ok: true }), live: null });
    expect(screen.getByText("Some future tool")).toBeInTheDocument();
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
  });
});
