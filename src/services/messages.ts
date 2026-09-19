import { ListMessagesQuery, ListMessagesResponse, SendMessageRequest, SendMessageResponse } from "@/contracts";
import { apiFetch } from "./api-client";

export const messagesService = {
  /** Newest-first page; `cursor` fetches older messages. */
  list: (chatId: string, query: ListMessagesQuery, signal?: AbortSignal) =>
    apiFetch({ path: `/chats/${chatId}/messages`, query, schema: ListMessagesResponse, signal }),
  send: (chatId: string, body: SendMessageRequest, idempotencyKey: string) =>
    apiFetch({ path: `/chats/${chatId}/messages`, method: "POST", body, schema: SendMessageResponse, idempotencyKey }),
};
