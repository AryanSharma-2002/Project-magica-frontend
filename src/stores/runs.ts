import { create } from "zustand";

/**
 * Active-run cache, keyed by chatId. The server (`Chat.activeRunId`, `GET /runs/:id`) is the
 * source of truth; this store just caches the realtime access needed to subscribe without an
 * extra round trip, and is safe to drop and rehydrate at any time.
 */
export type ActiveRun = {
  runId: string;
  triggerRunId: string | null;
  publicAccessToken: string | null;
  expiresAt: string | null;
};

export type RunsState = {
  byChatId: Record<string, ActiveRun>;
  setRun: (chatId: string, run: ActiveRun) => void;
  updateAccess: (
    chatId: string,
    access: { triggerRunId: string; publicAccessToken: string; expiresAt: string },
  ) => void;
  clearRun: (chatId: string) => void;
};

export const useRunsStore = create<RunsState>((set) => ({
  byChatId: {},
  setRun: (chatId, run) => set((s) => ({ byChatId: { ...s.byChatId, [chatId]: run } })),
  updateAccess: (chatId, access) =>
    set((s) => {
      const prev = s.byChatId[chatId];
      if (!prev) return s;
      return { byChatId: { ...s.byChatId, [chatId]: { ...prev, ...access } } };
    }),
  clearRun: (chatId) =>
    set((s) => {
      if (!(chatId in s.byChatId)) return s;
      const byChatId = { ...s.byChatId };
      delete byChatId[chatId];
      return { byChatId };
    }),
}));

/** Non-reactive accessor for use outside components (e.g. inside query functions). */
export const getActiveRun = (chatId: string): ActiveRun | undefined => useRunsStore.getState().byChatId[chatId];
