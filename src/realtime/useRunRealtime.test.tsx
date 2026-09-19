import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API, fixtures } from "@/test/msw/handlers";
import { createTestQueryClient } from "@/test/query-client";
import { runsService } from "@/services";
import { useRunsStore, type ActiveRun } from "@/stores/runs";
import { useRunRealtime } from "./useRunRealtime";

vi.mock("@trigger.dev/react-hooks", () => ({
  useRealtimeRun: () => ({ run: undefined, error: new Error("realtime down"), stop: vi.fn() }),
  useRealtimeStream: () => ({ parts: [], lastEventId: undefined, error: new Error("realtime down"), stop: vi.fn() }),
}));

function wrapperFor(client: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const run: ActiveRun = {
  runId: "run_1",
  triggerRunId: "trigger_run_1",
  publicAccessToken: "pub_tok",
  expiresAt: "2026-09-19T01:00:00.000Z",
};

function queryKeyOf(call: unknown[]): unknown {
  const arg = call[0] as { queryKey?: unknown } | undefined;
  return arg?.queryKey;
}

describe("useRunRealtime fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useRunsStore.setState({ byChatId: {} });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("switches to REST polling after 3 bounded reconnect attempts, and finalizes exactly once on terminal status", async () => {
    let runStatus: "running" | "completed" = "running";
    server.use(
      http.get(`${API}/runs/:runId`, ({ params }) => HttpResponse.json(fixtures.run({ id: String(params.runId), status: runStatus }))),
    );

    useRunsStore.getState().setRun("chat_1", run);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const getRunSpy = vi.spyOn(runsService, "get");

    const { result } = renderHook(() => useRunRealtime({ chatId: "chat_1", run, persisted: [] }), {
      wrapper: wrapperFor(client),
    });

    expect(result.current.transport).toBe("realtime");

    // Bounded reconnect: 1s, 2s, 4s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    await waitFor(() => expect(result.current.transport).toBe("polling"));

    // The fallback polls GET /runs/:id every 2s; while still running each tick also refreshes messages.
    await waitFor(() => expect(result.current.live.status).toBe("running"));
    expect(getRunSpy).toHaveBeenCalledWith("run_1", expect.anything());
    const pollCountWhileRunning = getRunSpy.mock.calls.length;
    const countWhileRunning = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(queryKeyOf(call)) === JSON.stringify(["messages", "chat_1"]),
    ).length;

    runStatus = "completed";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(result.current.live.status).toBe("completed"));
    // runsService.get was polled repeatedly (not a single one-shot fetch).
    expect(getRunSpy.mock.calls.length).toBeGreaterThan(pollCountWhileRunning);

    const messagesInvalidations = invalidateSpy.mock.calls.filter((call) => JSON.stringify(queryKeyOf(call)) === JSON.stringify(["messages", "chat_1"]));
    // Terminal reconciliation adds exactly one more invalidation (its own), not a duplicate from
    // the "still polling" message-refresh tick, which the implementation skips once terminal.
    expect(messagesInvalidations.length).toBe(countWhileRunning + 1);
    expect(useRunsStore.getState().byChatId["chat_1"]).toBeUndefined();

    // Further polling ticks must not re-invalidate.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    const messagesInvalidationsAfter = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(queryKeyOf(call)) === JSON.stringify(["messages", "chat_1"]),
    );
    expect(messagesInvalidationsAfter.length).toBe(messagesInvalidations.length);
  });
});
