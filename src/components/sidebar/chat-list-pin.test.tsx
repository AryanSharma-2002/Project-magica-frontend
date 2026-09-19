import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API, fixtures } from "@/test/msw/handlers";
import { createTestQueryClient } from "@/test/query-client";
import "@/test/dom-polyfills";
import { ChatList } from "./chat-list";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/chat_1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderChatList() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <ChatList />
    </QueryClientProvider>,
  );
  return client;
}

describe("ChatList pin", () => {
  it("pins optimistically and rolls back when the request fails", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/chats`, () => HttpResponse.json({ items: [fixtures.chat({ id: "chat_1", title: "Trip planning", pinned: false })], nextCursor: null })),
    );
    let settlePatch: ((res: Response) => void) | undefined;
    server.use(http.patch(`${API}/chats/:chatId`, () => new Promise<Response>((resolve) => { settlePatch = resolve; })));

    renderChatList();
    await screen.findByText("Trip planning");
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /actions for trip planning/i }));
    await user.click(await screen.findByText("Pin"));

    // Optimistic: shows in the Pinned section before the network response settles.
    await waitFor(() => expect(screen.getByText("Pinned")).toBeInTheDocument());

    settlePatch?.(HttpResponse.json({ error: { code: "internal", message: "boom", retryable: true, traceId: "t1" } }, { status: 500 }));

    await waitFor(() => expect(screen.queryByText("Pinned")).not.toBeInTheDocument());
  });
});
