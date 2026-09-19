import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Waitpoint, WaitpointPrompt } from "@/contracts";
import { WaitpointOverlay } from "./index";

function makeWaitpoint(prompt: WaitpointPrompt, overrides: Partial<Waitpoint> = {}): Waitpoint {
  return {
    id: "wp_1",
    runId: "run_1",
    toolInvocationId: null,
    type: prompt.type,
    status: "pending",
    prompt,
    resolution: null,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("WaitpointOverlay", () => {
  it("renders an approval prompt and resolves approved:true", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({
      type: "approval",
      title: "Run crop_image?",
      toolName: "crop_image",
      toolCallId: "call_1",
      input: { image_url: "https://x/img.png" },
      microcreditsEstimated: 270_000,
    });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    expect(screen.getByText("Run crop_image?")).toBeInTheDocument();
    expect(screen.getByText(/0\.27 credit/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "approval", approved: true }));
  });

  it("declines an approval prompt", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({
      type: "approval",
      title: "Run gpt_image_2?",
      toolName: "gpt_image_2",
      toolCallId: "call_2",
      input: { prompt: "a cat" },
      microcreditsEstimated: 500_000,
    });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: /decline/i }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "approval", approved: false }));
  });

  it("resolves an options prompt with the selected id, and requires a selection first", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({
      type: "options",
      title: "Which style?",
      multi: false,
      options: [
        { id: "a", label: "Sketch" },
        { id: "b", label: "Photo" },
      ],
    });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /sketch/i }));
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "options", selected: ["a"] }));
  });

  it("resolves a plan prompt: approve, and request-changes with feedback", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({
      type: "plan",
      title: "Proposed plan",
      steps: [{ id: "s1", title: "Crop the image" }, { id: "s2", title: "Generate a caption" }],
    });
    const { rerender } = render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: /^request changes$/i }));
    const textarea = screen.getByLabelText(/what should change/i);
    await user.type(textarea, "skip the caption");
    await user.click(screen.getByRole("button", { name: /send feedback/i }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "plan", approved: false, feedback: "skip the caption" }));

    onResolve.mockClear();
    rerender(<WaitpointOverlay waitpoint={{ ...waitpoint, id: "wp_2" }} onResolve={onResolve} />);
    await user.click(screen.getByRole("button", { name: /approve plan/i }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "plan", approved: true }));
  });

  it("resolves a credit prompt: proceed and cancel", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({ type: "credit", title: "Not enough credits?", microcreditsRequired: 1_000_000, microcreditsAvailable: 2_000_000 });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    await user.click(screen.getByRole("button", { name: /proceed/i }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "credit", proceed: true }));
  });

  it("disables Proceed when available credits are insufficient", () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({ type: "credit", title: "Low balance", microcreditsRequired: 2_000_000, microcreditsAvailable: 500_000 });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);
    expect(screen.getByRole("button", { name: /proceed/i })).toBeDisabled();
  });

  it("resolves only once on a double click", async () => {
    const user = userEvent.setup();
    let resolveOnResolve: () => void = () => {};
    const onResolve = vi.fn(() => new Promise<void>((resolve) => { resolveOnResolve = resolve; }));
    const waitpoint = makeWaitpoint({ type: "credit", title: "Proceed?", microcreditsRequired: 1, microcreditsAvailable: 2 });
    render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);

    await user.dblClick(screen.getByRole("button", { name: /proceed/i }));
    resolveOnResolve();
    await waitFor(() => expect(onResolve).toHaveBeenCalledTimes(1));
  });

  it("declines on Escape for approval, but is a no-op on Escape for options", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const waitpoint = makeWaitpoint({
      type: "approval",
      title: "Run merge_videos?",
      toolName: "merge_videos",
      toolCallId: "call_3",
      input: {},
      microcreditsEstimated: 100_000,
    });
    const { rerender } = render(<WaitpointOverlay waitpoint={waitpoint} onResolve={onResolve} />);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith({ type: "approval", approved: false }));

    onResolve.mockClear();
    const optionsWaitpoint = makeWaitpoint({ type: "options", title: "Pick one", multi: false, options: [{ id: "a", label: "A" }] }, { id: "wp_options" });
    rerender(<WaitpointOverlay waitpoint={optionsWaitpoint} onResolve={onResolve} />);
    await user.keyboard("{Escape}");
    expect(onResolve).not.toHaveBeenCalled();
  });
});
