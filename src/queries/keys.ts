/** Query key factory. Every hook and every invalidation uses these; no ad-hoc keys. */
export const qk = {
  config: ["config"] as const,
  balance: ["credits", "balance"] as const,
  ledger: ["credits", "ledger"] as const,
  chats: {
    all: ["chats"] as const,
    list: (filters: { pinned?: boolean; q?: string } = {}) => ["chats", "list", filters] as const,
    detail: (chatId: string) => ["chats", "detail", chatId] as const,
  },
  messages: (chatId: string) => ["messages", chatId] as const,
  run: (runId: string) => ["runs", runId] as const,
  attachments: (filters: { kind?: string; source?: string } = {}) => ["attachments", filters] as const,
  search: (q: string) => ["search", q] as const,
};
