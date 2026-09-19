import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Message } from "@/contracts";
import { MessageList } from "./message-list";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 120, size: 120 })),
    getTotalSize: () => count * 120,
    measureElement: () => {},
  }),
}));

function baseMessage(over: Partial<Message>): Message {
  return {
    id: "m",
    chatId: "chat_1",
    role: "user",
    status: "completed",
    content: [],
    runId: null,
    attachments: [],
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...over,
  };
}

describe("MessageList", () => {
  it("renders user, assistant, failed, and cancelled bubbles distinctly, with Retry on failed", () => {
    const messages: Message[] = [
      baseMessage({ id: "u1", role: "user", status: "completed", content: [{ type: "text", text: "Hello agent" }] }),
      baseMessage({ id: "a1", role: "assistant", status: "completed", content: [{ type: "text", text: "Hi there!" }] }),
      baseMessage({
        id: "u2",
        role: "user",
        status: "failed",
        content: [
          { type: "text", text: "Do the thing" },
          { type: "error", error: { code: "run_active", message: "A response is already in progress", retryable: false } },
        ],
      }),
      baseMessage({ id: "a2", role: "assistant", status: "cancelled", content: [{ type: "text", text: "partial output" }] }),
    ];

    const onRetry = vi.fn();
    render(<MessageList messages={messages} onOpenAsset={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(screen.getByText("Hello agent")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();

    expect(screen.getByText("Do the thing")).toBeInTheDocument();
    expect(screen.getByText("A response is already in progress")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeVisible();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledWith(messages[2]);

    expect(screen.getByText("partial output")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    const failedBubble = document.querySelector('[data-message-id="u2"]');
    expect(failedBubble).toHaveAttribute("data-status", "failed");
    const cancelledBubble = document.querySelector('[data-message-id="a2"]');
    expect(cancelledBubble).toHaveAttribute("data-status", "cancelled");
  });
});
