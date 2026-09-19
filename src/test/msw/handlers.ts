import { http, HttpResponse } from "msw";
import { API_PREFIX, DEFAULT_LIMITS, type AgentRun, type AppConfig, type Chat, type Message, type RealtimeAccess, type SearchHit, type Waitpoint, type GetRunResponse } from "@/contracts";

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
  run: (over: Partial<GetRunResponse> = {}): GetRunResponse => ({
    realtime: null,
    id: "run_1",
    chatId: "chat_1",
    userMessageId: "msg_user_1",
    assistantMessageId: "msg_assistant_1",
    status: "running",
    requestedModel: "openrouter/free",
    routedModel: null,
    planMode: false,
    currentStep: null,
    usage: null,
    microcreditsReserved: 10_000,
    microcreditsCharged: 0,
    error: null,
    toolInvocations: [],
    waitpoint: null,
    loadedSkills: [],
    triggerRunId: "trigger_run_1",
    startedAt: "2026-09-19T00:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...over,
  }),
  realtimeAccess: (over: Partial<RealtimeAccess> = {}): RealtimeAccess => ({
    triggerRunId: "trigger_run_1",
    publicAccessToken: "pub_token",
    expiresAt: "2026-09-19T01:00:00.000Z",
    streamId: "agent-text",
    ...over,
  }),
  waitpoint: (over: Partial<Waitpoint> = {}): Waitpoint => ({
    id: "wp_1",
    runId: "run_1",
    toolInvocationId: "inv_1",
    type: "approval",
    status: "pending",
    prompt: {
      type: "approval",
      title: "Approve this action?",
      toolName: "crop_image",
      toolCallId: "call_1",
      input: {},
      microcreditsEstimated: 5000,
    },
    resolution: null,
    expiresAt: "2026-09-19T00:10:00.000Z",
    resolvedAt: null,
    createdAt: "2026-09-19T00:00:00.000Z",
    ...over,
  }),
  searchHit: (over: Partial<SearchHit> = {}): SearchHit => ({
    chatId: "chat_1",
    chatTitle: "New chat",
    messageId: "msg_1",
    snippet: "Hello",
    createdAt: "2026-09-19T00:00:00.000Z",
    ...over,
  }),
};

export const handlers = [
  http.get(`${API}/config`, () => HttpResponse.json(fixtures.config)),
  http.get(`${API}/chats`, () => HttpResponse.json({ items: [fixtures.chat()], nextCursor: null })),
  http.post(`${API}/chats`, async ({ request }) => {
    const body = (await request.json()) as { title?: string };
    return HttpResponse.json(fixtures.chat({ id: "chat_new", title: body.title ?? "New chat" }));
  }),
  http.get(`${API}/chats/:chatId`, ({ params }) => HttpResponse.json(fixtures.chat({ id: String(params.chatId) }))),
  http.patch(`${API}/chats/:chatId`, async ({ params, request }) => {
    const body = (await request.json()) as { title?: string; pinned?: boolean };
    return HttpResponse.json(fixtures.chat({ id: String(params.chatId), ...body }));
  }),
  http.delete(`${API}/chats/:chatId`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/chats/:chatId/messages`, () => HttpResponse.json({ items: [fixtures.message()], nextCursor: null })),
  http.post(`${API}/chats/:chatId/messages`, ({ params }) =>
    HttpResponse.json({
      chatId: String(params.chatId),
      messageId: "msg_user_new",
      assistantMessageId: "msg_assistant_new",
      runId: "run_new",
      realtime: fixtures.realtimeAccess(),
      deduplicated: false,
    }),
  ),
  http.get(`${API}/runs/:runId`, ({ params }) => HttpResponse.json(fixtures.run({ id: String(params.runId) }))),
  http.post(`${API}/runs/:runId/cancel`, ({ params }) => HttpResponse.json(fixtures.run({ id: String(params.runId), status: "stopping" }))),
  http.post(`${API}/runs/:runId/realtime-token`, () => HttpResponse.json(fixtures.realtimeAccess())),
  http.post(`${API}/waitpoints/:id/complete`, ({ params }) => HttpResponse.json(fixtures.waitpoint({ id: String(params.id), status: "completed" }))),
  http.get(`${API}/search`, ({ request }) => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return HttpResponse.json({ items: q ? [fixtures.searchHit()] : [], nextCursor: null });
  }),
  http.get(`${API}/credits/balance`, () => HttpResponse.json({ microcredits: 100_000_000, updatedAt: "2026-09-19T00:00:00.000Z" })),
];
