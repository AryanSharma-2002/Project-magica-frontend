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

describe("ChatList delete", () => {
  it("requires confirmation before deleting, and cancel does not delete", async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API}/chats`, () => HttpResponse.json({ items: [fixtures.chat({ id: "chat_1", title: "Trip planning" })], nextCursor: null })));
    let deleteCalled = false;
    server.use(
      http.delete(`${API}/chats/:chatId`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderChatList();
    await screen.findByText("Trip planning");

    await user.click(screen.getByRole("button", { name: /actions for trip planning/i }));
    await user.click(await screen.findByText("Delete"));

    expect(await screen.findByText("Delete this task?")).toBeInTheDocument();
    expect(deleteCalled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Delete this task?")).not.toBeInTheDocument());
    expect(deleteCalled).toBe(false);
  });
});
