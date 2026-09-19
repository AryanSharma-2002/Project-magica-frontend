import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API, fixtures } from "@/test/msw/handlers";
import { createTestQueryClient } from "@/test/query-client";
import type { Message, Page } from "@/contracts";
import { qk } from "./keys";
import { useRetryMessage, useSendMessage } from "./messages";

function wrapperFor(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function itemsOf(client: ReturnType<typeof createTestQueryClient>, chatId: string): Message[] {
  const data = client.getQueryData<InfiniteData<Page<Message>>>(qk.messages(chatId));
  return data?.pages[0]?.items ?? [];
}

describe("useSendMessage", () => {
  it("optimistically inserts a pending user message + assistant placeholder, then swaps in server ids", async () => {
    let resolveSend: (() => void) | undefined;
    server.use(
      http.post(`${API}/chats/:chatId/messages`, async () => {
        await new Promise<void>((resolve) => {
          resolveSend = resolve;
        });
        return HttpResponse.json({
          chatId: "chat_1",
          messageId: "msg_user_srv",
          assistantMessageId: "msg_assistant_srv",
          runId: "run_srv",
          realtime: fixtures.realtimeAccess(),
          deduplicated: false,
        });
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useSendMessage("chat_1"), { wrapper: wrapperFor(client) });

    act(() => {
      result.current.mutate({ text: "Hello there", attachmentIds: [], planMode: false });
    });

    await waitFor(() => expect(itemsOf(client, "chat_1")).toHaveLength(2));
    const beforeIds = itemsOf(client, "chat_1");
    expect(beforeIds[0]).toMatchObject({ role: "assistant", status: "pending" });
    expect(beforeIds[1]).toMatchObject({ role: "user", status: "pending" });

    resolveSend?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const afterIds = itemsOf(client, "chat_1");
    expect(afterIds.find((m) => m.role === "user")?.id).toBe("msg_user_srv");
    expect(afterIds.find((m) => m.role === "assistant")?.id).toBe("msg_assistant_srv");
    expect(afterIds.find((m) => m.role === "user")?.status).toBe("completed");
  });

  it("marks the optimistic user message failed on run_active and rejects (composer keeps the draft)", async () => {
    server.use(
      http.post(`${API}/chats/:chatId/messages`, () =>
        HttpResponse.json({ error: { code: "run_active", message: "A run is already active", retryable: false, traceId: "t1" } }, { status: 409 }),
      ),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useSendMessage("chat_1"), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(result.current.mutateAsync({ text: "Hi", attachmentIds: [], planMode: false })).rejects.toMatchObject({ code: "run_active" });
    });

    const items = itemsOf(client, "chat_1");
    expect(items).toHaveLength(1);
    const userMsg = items[0];
    expect(userMsg?.status).toBe("failed");
    expect(userMsg?.content.some((b) => b.type === "error" && b.error.code === "run_active")).toBe(true);
  });

  it("reuses the same Idempotency-Key when a failed send is retried", async () => {
    const seenKeys: (string | null)[] = [];
    let attempt = 0;
    server.use(
      http.post(`${API}/chats/:chatId/messages`, ({ request }) => {
        seenKeys.push(request.headers.get("idempotency-key"));
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json({ error: { code: "internal", message: "boom", retryable: true, traceId: "t1" } }, { status: 500 });
        }
        return HttpResponse.json({
          chatId: "chat_1",
          messageId: "msg_user_ok",
          assistantMessageId: "msg_assistant_ok",
          runId: "run_ok",
          realtime: fixtures.realtimeAccess(),
          deduplicated: false,
        });
      }),
    );

    const client = createTestQueryClient();
    const { result: sendResult } = renderHook(() => useSendMessage("chat_1"), { wrapper: wrapperFor(client) });
    await act(async () => {
      await expect(sendResult.current.mutateAsync({ text: "Hi", attachmentIds: [], planMode: false })).rejects.toBeTruthy();
    });

    const failedUser = itemsOf(client, "chat_1").find((m) => m.role === "user" && m.status === "failed");
    expect(failedUser).toBeTruthy();

    const { result: retryResult } = renderHook(() => useRetryMessage("chat_1"), { wrapper: wrapperFor(client) });
    await act(async () => {
      await retryResult.current.mutateAsync(failedUser as Message);
    });

    expect(seenKeys).toHaveLength(2);
    expect(seenKeys[0]).toBeTruthy();
    expect(seenKeys[0]).toBe(seenKeys[1]);
    expect(itemsOf(client, "chat_1").find((m) => m.role === "user")?.status).toBe("completed");
  });
});
