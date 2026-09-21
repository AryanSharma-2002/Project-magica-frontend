import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/contracts";
import { MessageBubble } from "./message-bubble";

function baseMessage(over: Partial<Message>): Message {
  return {
    id: "m1",
    chatId: "chat_1",
    role: "assistant",
    status: "completed",
    content: [],
    runId: "run_1",
    attachments: [],
    createdAt: "2026-09-19T14:28:00.000Z",
    updatedAt: "2026-09-19T14:28:00.000Z",
    ...over,
  };
}

describe("MessageBubble (assistant)", () => {
  it('reads "Working…" while the message is streaming, even before live metadata attaches', () => {
    const message = baseMessage({
      status: "streaming",
      content: [{ type: "tool_use", toolCallId: "c1", invocationId: "inv_1", toolName: "crop_image", input: null }],
    });
    // `live` is null: useChatRun hasn't attached run metadata yet, but the message is already
    // marked pending/streaming — the header must not read "Completed 1 step" prematurely.
    render(<MessageBubble message={message} live={null} onOpenAsset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Working…" })).toBeInTheDocument();
  });

  it("opens the artifact panel when a generated-asset card is clicked", async () => {
    const onOpenAsset = vi.fn();
    const message = baseMessage({
      content: [{ type: "asset", kind: "image", url: "https://x.test/out.png", width: 512, height: 512 }],
    });
    render(<MessageBubble message={message} onOpenAsset={onOpenAsset} />);

    const card = screen.getByRole("button", { name: /view generated image/i });
    card.click();
    expect(onOpenAsset).toHaveBeenCalledWith("https://x.test/out.png");
  });
});
