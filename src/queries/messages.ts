"use client";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import {
  OPENROUTER_FREE_MODEL,
  PAGE_LIMIT_DEFAULT,
  type ContentBlock,
  type Message,
  type Page,
  type SafeError,
  type SendMessageRequest,
} from "@/contracts";
import { ApiError, messagesService } from "@/services";
import { useRunsStore } from "@/stores/runs";
import { qk } from "./keys";

type MessagesData = InfiniteData<Page<Message>>;

/** `useMessages` fetches newest-first pages; this flattens + reverses to oldest -> newest for render. */
export function useMessages(chatId: string | null) {
  const query = useInfiniteQuery({
    queryKey: qk.messages(chatId ?? ""),
    queryFn: ({ pageParam, signal }) =>
      messagesService.list(chatId as string, { limit: PAGE_LIMIT_DEFAULT, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(chatId),
  });

  const messages = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const newestFirst = pages.flatMap((page) => page.items);
    return [...newestFirst].reverse();
  }, [query.data]);

  return {
    ...query,
    /** Oldest -> newest, ready to render top-to-bottom. */
    messages,
    hasOlder: query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    fetchOlder: query.fetchNextPage,
  };
}

// ---- send / retry ----------------------------------------------------------

function emptyMessagesData(): MessagesData {
  return { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] };
}

function prependMessages(queryClient: QueryClient, chatId: string, messages: Message[]): void {
  queryClient.setQueryData<MessagesData>(qk.messages(chatId), (prev) => {
    const data = prev ?? emptyMessagesData();
    const pages = [...data.pages];
    const first = pages[0] ?? { items: [], nextCursor: null };
    pages[0] = { ...first, items: [...messages, ...first.items] };
    return { ...data, pages };
  });
}

function updateMessage(queryClient: QueryClient, chatId: string, id: string, updater: (m: Message) => Message): void {
  queryClient.setQueryData<MessagesData>(qk.messages(chatId), (prev) => {
    if (!prev) return prev;
    return { ...prev, pages: prev.pages.map((page) => ({ ...page, items: page.items.map((m) => (m.id === id ? updater(m) : m)) })) };
  });
}

function removeMessage(queryClient: QueryClient, chatId: string, id: string): void {
  queryClient.setQueryData<MessagesData>(qk.messages(chatId), (prev) => {
    if (!prev) return prev;
    return { ...prev, pages: prev.pages.map((page) => ({ ...page, items: page.items.filter((m) => m.id !== id) })) };
  });
}

function extractText(message: Message): string {
  const block = message.content.find((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text");
  return block?.text ?? "";
}

function toSafeError(error: unknown): SafeError {
  if (error instanceof ApiError) return { code: error.code, message: error.message, retryable: error.retryable, details: error.details };
  return { code: "internal", message: "Something went wrong sending your message.", retryable: true };
}

type PendingSend = { idempotencyKey: string; chatId: string; request: SendMessageRequest };
/** Optimistic-message-id -> the request that produced it, so Retry reuses the same Idempotency-Key. */
const pendingSends = new Map<string, PendingSend>();

async function performSend(
  queryClient: QueryClient,
  chatId: string,
  request: SendMessageRequest,
  ids: { userId: string; assistantId: string; idempotencyKey: string },
) {
  const { userId, assistantId, idempotencyKey } = ids;
  try {
    const res = await messagesService.send(chatId, request, idempotencyKey);
    updateMessage(queryClient, chatId, userId, (m) => ({ ...m, id: res.messageId, status: "completed", runId: res.runId }));
    updateMessage(queryClient, chatId, assistantId, (m) => ({ ...m, id: res.assistantMessageId, runId: res.runId }));
    useRunsStore.getState().setRun(chatId, {
      runId: res.runId,
      triggerRunId: res.realtime.triggerRunId,
      publicAccessToken: res.realtime.publicAccessToken,
      expiresAt: res.realtime.expiresAt,
    });
    pendingSends.delete(userId);
    void queryClient.invalidateQueries({ queryKey: qk.chats.all });
    return res;
  } catch (error) {
    const safe = toSafeError(error);
    updateMessage(queryClient, chatId, userId, (m) => ({
      ...m,
      status: "failed",
      content: [{ type: "text", text: request.text }, { type: "error", error: safe }],
    }));
    removeMessage(queryClient, chatId, assistantId);
    if (error instanceof ApiError && error.code === "run_active") {
      toast.error("A response is already in progress in this chat.");
    }
    throw error;
  }
}

export type SendMessageInput = { chatId?: string; text: string; attachmentIds: string[]; planMode: boolean };

/**
 * Optimistic send: inserts a `pending` user message and an `assistant` placeholder into the
 * messages cache immediately, then POSTs. `chatId` in the mutation variables always wins over the
 * hook's bound chatId — the new-chat page creates the chat first, then sends against its fresh id
 * without needing a second hook instance.
 */
export function useSendMessage(defaultChatId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: SendMessageInput) => {
      const chatId = variables.chatId ?? defaultChatId;
      if (!chatId) throw new Error("useSendMessage: no chatId to send to");
      const idempotencyKey = crypto.randomUUID();
      const userId = `optimistic-user-${idempotencyKey}`;
      const assistantId = `optimistic-assistant-${idempotencyKey}`;
      const now = new Date().toISOString();

      const userMessage: Message = {
        id: userId,
        chatId,
        role: "user",
        status: "pending",
        content: [{ type: "text", text: variables.text }],
        runId: null,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      const assistantMessage: Message = {
        id: assistantId,
        chatId,
        role: "assistant",
        status: "pending",
        content: [],
        runId: null,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      prependMessages(queryClient, chatId, [assistantMessage, userMessage]);

      const request: SendMessageRequest = {
        text: variables.text,
        attachmentIds: variables.attachmentIds,
        model: OPENROUTER_FREE_MODEL,
        planMode: variables.planMode,
      };
      pendingSends.set(userId, { idempotencyKey, chatId, request });
      return performSend(queryClient, chatId, request, { userId, assistantId, idempotencyKey });
    },
  });
}

/** Resend a `failed` user message, reusing its original Idempotency-Key. */
export function useRetryMessage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: Message) => {
      const pending = pendingSends.get(message.id);
      const idempotencyKey = pending?.idempotencyKey ?? crypto.randomUUID();
      const request: SendMessageRequest = pending?.request ?? {
        text: extractText(message),
        attachmentIds: [],
        model: OPENROUTER_FREE_MODEL,
        planMode: false,
      };
      const assistantId = `optimistic-assistant-${idempotencyKey}`;
      const now = new Date().toISOString();

      updateMessage(queryClient, chatId, message.id, (m) => ({
        ...m,
        status: "pending",
        content: [{ type: "text", text: request.text }],
      }));
      prependMessages(queryClient, chatId, [
        { id: assistantId, chatId, role: "assistant", status: "pending", content: [], runId: null, attachments: [], createdAt: now, updatedAt: now },
      ]);
      pendingSends.set(message.id, { idempotencyKey, chatId, request });
      return performSend(queryClient, chatId, request, { userId: message.id, assistantId, idempotencyKey });
    },
  });
}
