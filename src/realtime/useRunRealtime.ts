"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks";
import type { AnyTask } from "@trigger.dev/sdk";
import { AGENT_TEXT_STREAM_ID, RunMetadata, TERMINAL_RUN_STATUSES, type ContentBlock, type TextChunk } from "@/contracts";
import { runsService } from "@/services";
import { qk } from "@/queries/keys";
import { useRun } from "@/queries/runs";
import { useRunsStore, type ActiveRun } from "@/stores/runs";
import { buildLiveView, type LiveView } from "./liveView";

/**
 * Wires a run's realtime channels (Trigger run metadata + the `agent-text` stream) into a
 * `LiveView`, with bounded reconnect and a REST polling fallback. See ARCHITECTURE §6.
 *
 * Verified against `@trigger.dev/react-hooks` 4.6.3's compiled source
 * (`dist/esm/hooks/useRealtime.js`): both `useRealtimeRun` and `useRealtimeStream` only
 * resubscribe when their `runId` or `enabled` option changes (the request callback itself is
 * wrapped in a permanently-stable `useCallback`, so a changed `accessToken` alone does NOT
 * reconnect). Forcing a reconnect therefore means flipping `enabled` off then on. `useApiClient`
 * (used internally by both hooks) *throws* if no `accessToken` is available and `enabled` is not
 * exactly `false` — so `enabled` must gate on having credentials, not just "should we run".
 */

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000];
const POLL_INTERVAL_MS = 2000;

export type Transport = "realtime" | "polling" | "idle";

export type UseRunRealtimeInput = {
  chatId: string;
  run: ActiveRun | null;
  /** Persisted content of the assistant message this run is producing. */
  persisted: ContentBlock[];
};

export type UseRunRealtimeResult = {
  live: LiveView;
  transport: Transport;
  error: Error | null;
};

const IDLE_VIEW: LiveView = {
  blocks: [],
  status: null,
  step: null,
  progress: null,
  thinkingMs: null,
  tools: {},
  waitpoint: null,
  error: null,
};

export function useRunRealtime({ chatId, run, persisted }: UseRunRealtimeInput): UseRunRealtimeResult {
  const queryClient = useQueryClient();
  const runId = run?.runId ?? null;
  const triggerRunId = run?.triggerRunId ?? null;

  const [accessToken, setAccessToken] = useState<string | null>(run?.publicAccessToken ?? null);
  const [enabled, setEnabled] = useState(true);
  const [attempt, setAttempt] = useState(0);
  /** Set only when a reload-time token fetch fails outright; the bounded-reconnect exhaustion
   *  case is a *derived* value (see `polling` below) rather than state, so switching to it is not
   *  a "setState in an effect" side effect. */
  const [forcedPolling, setForcedPolling] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizedRunIdRef = useRef<string | null>(null);

  // A new run (or leaving the run entirely) resets all local realtime bookkeeping. Adjusted during
  // render (React's documented pattern for "reset state when a prop changes") rather than in an
  // effect, so it can't cascade through an extra commit.
  const [trackedRunId, setTrackedRunId] = useState(runId);
  if (trackedRunId !== runId) {
    setTrackedRunId(runId);
    setAccessToken(run?.publicAccessToken ?? null);
    setEnabled(true);
    setAttempt(0);
    setForcedPolling(false);
    setIsTerminal(false);
  }

  // Reload / navigation recovery: `Chat.activeRunId` hydration may not carry a realtime token yet.
  useEffect(() => {
    if (!runId || accessToken) return;
    let cancelled = false;
    runsService
      .realtimeToken(runId)
      .then((access) => {
        if (cancelled) return;
        setAccessToken(access.publicAccessToken);
        useRunsStore.getState().updateAccess(chatId, access);
      })
      .catch(() => {
        if (!cancelled) setForcedPolling(true);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, accessToken, chatId]);

  const reconnectExhausted = attempt >= MAX_RECONNECT_ATTEMPTS;
  const polling = forcedPolling || reconnectExhausted;
  const hasCredentials = Boolean(triggerRunId && accessToken) && !polling;

  const refreshAccessToken = useMemo(() => {
    if (!runId) return undefined;
    return async () => {
      const access = await runsService.realtimeToken(runId);
      setAccessToken(access.publicAccessToken);
      useRunsStore.getState().updateAccess(chatId, access);
      return access.publicAccessToken;
    };
  }, [runId, chatId]);

  const runSubscription = useRealtimeRun<AnyTask>(triggerRunId ?? "", {
    accessToken: accessToken ?? undefined,
    enabled: hasCredentials && enabled,
    refreshAccessToken,
  });

  const streamSubscription = useRealtimeStream<TextChunk>(triggerRunId ?? "", AGENT_TEXT_STREAM_ID, {
    accessToken: accessToken ?? undefined,
    enabled: hasCredentials && enabled,
    refreshAccessToken,
    startIndex: 0,
  });

  const transportError = runSubscription.error ?? streamSubscription.error ?? null;

  // Bounded reconnect: on error, wait then flip `enabled` off/on to force a fresh subscription.
  // Once `attempt` reaches MAX_RECONNECT_ATTEMPTS, `polling` (derived above) is already true and
  // `hasCredentials` false, so this effect naturally stops trying — no extra state transition needed.
  useEffect(() => {
    if (!transportError || !hasCredentials || reconnectExhausted) return undefined;
    const delay = RECONNECT_DELAYS_MS[attempt] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
    // Deliberate: synchronizing local "waiting to retry" state with an external signal (the
    // Trigger.dev subscription's error) is exactly what an effect is for; the lint heuristic
    // can't distinguish this from a derived-during-render value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(false);
    reconnectTimer.current = setTimeout(() => {
      setAttempt((a) => a + 1);
      setEnabled(true);
    }, delay);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportError]);

  // Fallback polling: REST for run status/waitpoint, every 2s. Message refetch rides the same
  // tick (keyed on `dataUpdatedAt`, not a second independent timer) so a terminal status and the
  // "refetch messages" tick can never race into a double invalidation — the terminal-reconciliation
  // effect below owns the single invalidation once the run is actually done.
  const polledRun = useRun(runId, {
    enabled: polling,
    refetchInterval: polling && !isTerminal ? POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!polling || !chatId || !polledRun.data) return;
    if ((TERMINAL_RUN_STATUSES as readonly string[]).includes(polledRun.data.status)) return;
    void queryClient.invalidateQueries({ queryKey: qk.messages(chatId), refetchType: "active" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polledRun.dataUpdatedAt]);

  const parsedMetadata = useMemo(() => {
    const raw = runSubscription.run?.metadata;
    if (!raw) return null;
    const parsed = RunMetadata.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }, [runSubscription.run?.metadata]);

  const realtimeView = useMemo(
    () => buildLiveView({ metadata: parsedMetadata, chunks: streamSubscription.parts, persisted }),
    [parsedMetadata, streamSubscription.parts, persisted],
  );

  const polledView: LiveView = useMemo(() => {
    const data = polledRun.data;
    if (!data) return { ...IDLE_VIEW, blocks: persisted };
    return {
      blocks: persisted,
      status: data.status,
      step: data.currentStep,
      progress: null,
      thinkingMs: null,
      tools: {},
      waitpoint: data.waitpoint
        ? { id: data.waitpoint.id, type: data.waitpoint.type, status: data.waitpoint.status, expiresAt: data.waitpoint.expiresAt }
        : null,
      error: data.error,
    };
  }, [polledRun.data, persisted]);

  const view = !run ? { ...IDLE_VIEW, blocks: persisted } : polling ? polledView : realtimeView;

  // Terminal reconciliation (ARCHITECTURE §6): invalidate once, clear the runs-store entry, and
  // let the persisted assistant message (picked up by the invalidated `qk.messages` query) replace
  // the live bubble — never render both.
  useEffect(() => {
    if (!run || !view.status) return;
    if (!(TERMINAL_RUN_STATUSES as readonly string[]).includes(view.status)) return;
    if (finalizedRunIdRef.current === run.runId) return;
    finalizedRunIdRef.current = run.runId;
    setIsTerminal(true);
    void queryClient.invalidateQueries({ queryKey: qk.messages(chatId) });
    void queryClient.invalidateQueries({ queryKey: qk.chats.detail(chatId) });
    void queryClient.invalidateQueries({ queryKey: qk.balance });
    useRunsStore.getState().clearRun(chatId);
  }, [view.status, run, chatId, queryClient]);

  const transport: Transport = !run ? "idle" : polling ? "polling" : hasCredentials ? "realtime" : "idle";

  return { live: view, transport, error: transportError ?? (polledRun.error as Error | null) ?? null };
}
