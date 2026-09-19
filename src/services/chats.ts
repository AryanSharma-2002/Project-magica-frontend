import { z } from "zod";
import { Chat, CreateChatRequest, ListChatsQuery, ListChatsResponse, UpdateChatRequest } from "@/contracts";
import { apiFetch } from "./api-client";

export const chatsService = {
  list: (query: ListChatsQuery, signal?: AbortSignal) => apiFetch({ path: "/chats", query, schema: ListChatsResponse, signal }),
  get: (chatId: string, signal?: AbortSignal) => apiFetch({ path: `/chats/${chatId}`, schema: Chat, signal }),
  create: (body: CreateChatRequest) => apiFetch({ path: "/chats", method: "POST", body, schema: Chat }),
  update: (chatId: string, body: UpdateChatRequest) => apiFetch({ path: `/chats/${chatId}`, method: "PATCH", body, schema: Chat }),
  remove: (chatId: string) => apiFetch({ path: `/chats/${chatId}`, method: "DELETE", schema: z.undefined() }),
};
