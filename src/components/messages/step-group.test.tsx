import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ContentBlock, ToolUseBlock } from "@/contracts";
import { StepGroup } from "./step-group";

function renderGroup(props: Partial<React.ComponentProps<typeof StepGroup>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaults: React.ComponentProps<typeof StepGroup> = {
    toolUseBlocks: [],
    blocks: [],
    live: null,
    isActive: false,
    onOpenAsset: vi.fn(),
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <StepGroup {...defaults} {...props} />
    </QueryClientProvider>,
  );
}

function toolUse(toolCallId: string, toolName: string, input: unknown = {}): ToolUseBlock {
  return { type: "tool_use", toolCallId, invocationId: `inv_${toolCallId}`, toolName, input: input as ToolUseBlock["input"] };
}

describe("StepGroup", () => {
  it("renders no header for a run with zero tool calls", () => {
    const { container } = renderGroup();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count in the header and toggles the step rows", async () => {
    const user = userEvent.setup();
    const toolUseBlocks = [toolUse("c1", "crop_image"), toolUse("c2", "gpt_image_2"), toolUse("c3", "merge_videos")];
    const blocks: ContentBlock[] = [
      ...toolUseBlocks,
      { type: "tool_result", toolCallId: "c1", invocationId: "inv_c1", toolName: "crop_image", status: "completed", durationMs: 4100 },
      { type: "tool_result", toolCallId: "c2", invocationId: "inv_c2", toolName: "gpt_image_2", status: "completed", durationMs: 362 },
      { type: "tool_result", toolCallId: "c3", invocationId: "inv_c3", toolName: "merge_videos", status: "completed", durationMs: 1000 },
    ];

    renderGroup({ toolUseBlocks, blocks });

    const header = screen.getByRole("button", { name: "Completed 3 steps" });
    expect(header).toBeInTheDocument();
    expect(screen.queryByText("4.1s")).not.toBeInTheDocument();

    await user.click(header);
    expect(screen.getByText("4.1s")).toBeInTheDocument();
    expect(screen.getByText("362ms")).toBeInTheDocument();

    await user.click(header);
    expect(screen.queryByText("4.1s")).not.toBeInTheDocument();
  });

  it("reads Working… while the run is active", () => {
    renderGroup({ toolUseBlocks: [toolUse("c1", "crop_image")], isActive: true });
    expect(screen.getByRole("button", { name: "Working…" })).toBeInTheDocument();
  });

  it("shows the singular form for exactly one step once complete", () => {
    renderGroup({ toolUseBlocks: [toolUse("c1", "crop_image")], isActive: false });
    expect(screen.getByRole("button", { name: "Completed 1 step" })).toBeInTheDocument();
  });

  it("expands a row into its tool card on click", async () => {
    const user = userEvent.setup();
    const toolUseBlocks = [toolUse("c1", "crop_image", { image_url: "https://x.test/a.png" })];
    const blocks: ContentBlock[] = [
      ...toolUseBlocks,
      { type: "tool_result", toolCallId: "c1", invocationId: "inv_c1", toolName: "crop_image", status: "completed", durationMs: 500 },
    ];
    renderGroup({ toolUseBlocks, blocks });

    await user.click(screen.getByRole("button", { name: "Completed 1 step" }));
    const row = screen.getByRole("button", { expanded: false });
    await user.click(row);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
