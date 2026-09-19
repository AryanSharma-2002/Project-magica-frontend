import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_LIMITS, type ModelInfo } from "@/contracts";
import { useComposerStore } from "@/stores/composer";
import { Composer, type ComposerProps } from "./index";

const models: ModelInfo[] = [{ id: "openrouter/free", label: "OpenRouter Free", provider: "openrouter", free: true, status: "available" }];

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSend = overrides.onSend ?? vi.fn().mockResolvedValue(undefined);
  const onStop = overrides.onStop ?? vi.fn().mockResolvedValue(undefined);
  const props: ComposerProps = {
    chatId: null,
    limits: DEFAULT_LIMITS,
    models,
    runStatus: null,
    ...overrides,
    onSend,
    onStop,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Composer {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, onSend, onStop, props };
}

beforeEach(() => {
  useComposerStore.setState({ drafts: {}, attachments: {}, planMode: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Composer", () => {
  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    const user = userEvent.setup();
    const { onSend } = renderComposer();
    const textarea = screen.getByRole("textbox", { name: /message/i });

    await user.type(textarea, "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(textarea, "line two");
    expect(textarea).toHaveValue("line one\nline two");
    expect(onSend).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({ text: "line one\nline two", attachmentIds: [], planMode: false });
  });

  it("blocks send and shows a message when the draft is over the character limit", async () => {
    const user = userEvent.setup();
    const limits = { ...DEFAULT_LIMITS, maxMessageChars: 10 };
    const { onSend } = renderComposer({ limits });
    const textarea = screen.getByRole("textbox", { name: /message/i });

    await user.type(textarea, "this message is way too long");
    expect(screen.getByText(/over the 10 limit/i)).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    await user.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows Stop while a run is active and calls onStop", async () => {
    const user = userEvent.setup();
    const { onStop } = renderComposer({ runStatus: "running" });

    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
    const stopButton = screen.getByRole("button", { name: /^stop$/i });
    await user.click(stopButton);
    await waitFor(() => expect(onStop).toHaveBeenCalledTimes(1));
  });

  it("disables send while waiting for a decision", async () => {
    const user = userEvent.setup();
    const { onSend } = renderComposer({ runStatus: "waiting" });
    const textarea = screen.getByRole("textbox", { name: /message/i });

    await user.type(textarea, "hello");
    expect(screen.getByText(/waiting for your decision/i)).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: /^send$/i });
    expect(sendButton).toBeDisabled();

    await user.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("persists the draft across remounts of the same chat", () => {
    const { unmount } = renderComposer({ chatId: "chat_1" });
    useComposerStore.getState().setDraft("chat_1", "saved draft");
    unmount();

    renderComposer({ chatId: "chat_1" });
    expect(screen.getByRole("textbox", { name: /message/i })).toHaveValue("saved draft");
  });

  it("keeps the draft when onSend rejects and surfaces the error", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error("network down"));
    renderComposer({ onSend });
    const textarea = screen.getByRole("textbox", { name: /message/i });

    await user.type(textarea, "hello there");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText("network down")).toBeInTheDocument());
    expect(textarea).toHaveValue("hello there");
  });
});
