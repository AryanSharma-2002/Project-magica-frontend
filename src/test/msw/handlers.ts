import { http, HttpResponse } from "msw";
import { API_PREFIX, DEFAULT_LIMITS, type AppConfig, type Chat, type Message } from "@/contracts";

/**
 * Contract-derived MSW handlers. Fixtures are typed with the vendored contracts so a contract
 * change breaks tests here before it breaks the UI. Slices add handlers by spreading into `handlers`.
 */
export const API = `http://api.test${API_PREFIX}`;

export const fixtures = {
  config: {
    limits: DEFAULT_LIMITS,
    models: [{ id: "openrouter/free", label: "OpenRouter Free", provider: "openrouter", free: true, status: "available" }],
    tools: [],
    skills: [],
  } satisfies AppConfig,
  chat: (over: Partial<Chat> = {}): Chat => ({
    id: "chat_1",
    title: "New chat",
    pinned: false,
    lastMessageAt: "2026-09-19T00:00:00.000Z",
    activeRunId: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...over,
  }),
  message: (over: Partial<Message> = {}): Message => ({
    id: "msg_1",
    chatId: "chat_1",
    role: "user",
    status: "completed",
    content: [{ type: "text", text: "Hello" }],
    runId: null,
    attachments: [],
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...over,
  }),
};

export const handlers = [
  http.get(`${API}/config`, () => HttpResponse.json(fixtures.config)),
  http.get(`${API}/chats`, () => HttpResponse.json({ items: [fixtures.chat()], nextCursor: null })),
  http.get(`${API}/chats/:chatId`, ({ params }) => HttpResponse.json(fixtures.chat({ id: String(params.chatId) }))),
  http.get(`${API}/chats/:chatId/messages`, () => HttpResponse.json({ items: [fixtures.message()], nextCursor: null })),
  http.get(`${API}/credits/balance`, () => HttpResponse.json({ microcredits: 100_000_000, updatedAt: "2026-09-19T00:00:00.000Z" })),
];
