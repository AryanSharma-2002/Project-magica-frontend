import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContentBlock, Message } from "@/contracts";
import { formatMessageTime } from "./format-time";
import { MessageFooter } from "./message-footer";

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

describe("MessageFooter", () => {
  it("formats charged tool credits with formatCredits and shows the time", () => {
    const blocks: ContentBlock[] = [
      { type: "tool_result", toolCallId: "c1", invocationId: "inv_1", toolName: "gpt_image_2", status: "completed", microcredits: 150_000 },
    ];
    const message = baseMessage({ content: blocks });
    render(<MessageFooter message={message} blocks={blocks} />);
    expect(screen.getByText("0.15M credits")).toBeInTheDocument();
    expect(screen.getByText(formatMessageTime(message.createdAt))).toBeInTheDocument();
  });

  it("renders nothing for a message with no credits that hasn't completed", () => {
    const { container } = render(<MessageFooter message={baseMessage({ status: "pending" })} blocks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("still shows a failed run's charged credits without a time row", () => {
    const blocks: ContentBlock[] = [
      { type: "tool_result", toolCallId: "c1", invocationId: "inv_1", toolName: "crop_image", status: "completed", microcredits: 150_000 },
      { type: "error", error: { code: "internal", message: "boom", retryable: false } },
    ];
    const message = baseMessage({ status: "failed", content: blocks });
    render(<MessageFooter message={message} blocks={blocks} />);
    expect(screen.getByText("0.15M credits")).toBeInTheDocument();
    expect(screen.queryByText(formatMessageTime(message.createdAt))).not.toBeInTheDocument();
  });
});
