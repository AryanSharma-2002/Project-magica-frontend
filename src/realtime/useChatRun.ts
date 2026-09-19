"use client";
import { useEffect } from "react";
import { ACTIVE_RUN_STATUSES, type Chat, type ContentBlock } from "@/contracts";
import { runsService } from "@/services";
import { useRunsStore, type ActiveRun } from "@/stores/runs";
import { useRunRealtime, type Transport } from "./useRunRealtime";
import type { LiveView } from "./liveView";

export type UseChatRunResult = {
  run: ActiveRun | null;
  live: LiveView;
  transport: Transport;
  error: Error | null;
};

/**
 * Selects the active-run cache entry for a chat, hydrating it from `Chat.activeRunId` on first
 * load / navigation (ARCHITECTURE §6) when the store doesn't already have it, then subscribes.
 */
export function useChatRun(chatId: string | null, chat: Chat | null | undefined, persisted: ContentBlock[]): UseChatRunResult {
  const run = useRunsStore((s) => (chatId ? (s.byChatId[chatId] ?? null) : null));

  useEffect(() => {
    if (!chatId || !chat?.activeRunId || run) return;
    let cancelled = false;
    const activeRunId = chat.activeRunId;
    void (async () => {
      try {
        const fetchedRun = await runsService.get(activeRunId);
        if (cancelled || !(ACTIVE_RUN_STATUSES as readonly string[]).includes(fetchedRun.status)) return;
        const access = await runsService.realtimeToken(fetchedRun.id).catch(() => null);
        if (cancelled) return;
        useRunsStore.getState().setRun(chatId, {
          runId: fetchedRun.id,
          triggerRunId: fetchedRun.triggerRunId,
          publicAccessToken: access?.publicAccessToken ?? null,
          expiresAt: access?.expiresAt ?? null,
        });
      } catch {
        // Best-effort; the chat page still renders persisted content.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, chat?.activeRunId, run]);

  const { live, transport, error } = useRunRealtime({ chatId: chatId ?? "", run, persisted });
  return { run, live, transport, error };
}
