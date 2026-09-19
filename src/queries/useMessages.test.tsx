import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API, fixtures } from "@/test/msw/handlers";
import { encodeCursor } from "@/contracts";
import { createTestQueryClient } from "@/test/query-client";
import { useMessages } from "./messages";

function wrapperFor(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useMessages", () => {
  it("flattens newest-first pages into oldest -> newest order, and fetchOlder loads further back", async () => {
    const msg1 = fixtures.message({ id: "msg_1", content: [{ type: "text", text: "oldest" }], createdAt: "2026-09-19T00:00:00.000Z" });
    const msg2 = fixtures.message({ id: "msg_2", content: [{ type: "text", text: "middle" }], createdAt: "2026-09-19T00:01:00.000Z" });
    const msg3 = fixtures.message({ id: "msg_3", content: [{ type: "text", text: "newest" }], createdAt: "2026-09-19T00:02:00.000Z" });
    const cursorAfterPage1 = encodeCursor(msg2.createdAt, msg2.id);

    server.use(
      http.get(`${API}/chats/:chatId/messages`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (!cursor) return HttpResponse.json({ items: [msg3, msg2], nextCursor: cursorAfterPage1 });
        expect(cursor).toBe(cursorAfterPage1);
        return HttpResponse.json({ items: [msg1], nextCursor: null });
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useMessages("chat_1"), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg_2", "msg_3"]);
    expect(result.current.hasOlder).toBe(true);

    await act(async () => {
      await result.current.fetchOlder();
    });

    await waitFor(() => expect(result.current.hasOlder).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["msg_1", "msg_2", "msg_3"]);
  });

  it("is disabled and returns no messages when chatId is null", () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useMessages(null), { wrapper: wrapperFor(client) });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isFetching).toBe(false);
  });
});
