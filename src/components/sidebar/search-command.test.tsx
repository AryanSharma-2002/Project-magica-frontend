import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API } from "@/test/msw/handlers";
import { createTestQueryClient } from "@/test/query-client";
import { useUiStore } from "@/stores/ui";
import "@/test/dom-polyfills";
import { SearchCommand } from "./search-command";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderSearch() {
  const client = createTestQueryClient();
  render(
    <QueryClientProvider client={client}>
      <SearchCommand />
    </QueryClientProvider>,
  );
}

describe("SearchCommand", () => {
  it("navigates to the selected chat", async () => {
    server.use(
      http.get(`${API}/search`, ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (!q) return HttpResponse.json({ items: [], nextCursor: null });
        return HttpResponse.json({
          items: [{ chatId: "chat_42", chatTitle: "Vacation photos", messageId: "msg_1", snippet: "crop these", createdAt: "2026-09-19T00:00:00.000Z" }],
          nextCursor: null,
        });
      }),
    );

    useUiStore.getState().setCommandPaletteOpen(true);
    const user = userEvent.setup({ delay: null });
    renderSearch();

    const input = await screen.findByPlaceholderText(/search chats and messages/i);
    await user.type(input, "vacation");

    const hit = await screen.findByText("Vacation photos", {}, { timeout: 2000 });
    await user.click(hit);

    expect(push).toHaveBeenCalledWith("/chat/chat_42");
    await waitFor(() => expect(useUiStore.getState().commandPaletteOpen).toBe(false));
  });
});
