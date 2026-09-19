# agent-chat-frontend — Architecture

The canonical design lives in the backend repo: **agent-chat-backend/ARCHITECTURE.md** (sections 1, 3, 5, 6, 9, 10, 11, 12 apply directly to this repo). This file only records frontend-specific rules.

## Rules
1. `src/contracts/` is **vendored** from the backend (`pnpm contracts:sync`), verified by `pnpm contracts:check`, and never hand-edited. Import from `@/contracts` only.
2. All backend access goes through `src/services/*` (`apiFetch` in `api-client.ts`) and TanStack Query hooks in `src/queries/*`. Components never call `fetch`.
3. Backend owns limits, model metadata, tool descriptors and skills: read them from `GET /api/v1/config` (`useConfig()`); never hardcode.
4. Rendering is registry-driven: `blockRenderers` (by `ContentBlock.type`), `toolCards` (by tool name, with a default), `waitpointRenderers` (by waitpoint type). Adding a tool/waitpoint type touches only a registry.
5. Realtime is transport. While a run is active the assistant bubble renders from the live view (Trigger metadata + `agent-text` stream, ordered by block `index`); on terminal status it renders persisted content from `GET /chats/:id/messages`. Reconnect is bounded (3 tries + token refresh), then REST polling.
6. Zustand stores are small caches (`ui`, `composer`, `runs`); the server is the source of truth (`Chat.activeRunId`, `GET /runs/:id`).
7. Design tokens live in `src/app/globals.css`; components use tokens/shadcn primitives so the fidelity pass against app.magica.com is a token/spacing change, not a rewrite.
8. Accessibility is required: focus management in overlays, `aria-live` for streaming, keyboard shortcuts (Enter send, Shift+Enter newline, Esc stop/close, ⌘K search), labelled controls, visible retry paths on failed turns.

## Layout
```
src/app/                 layout (ClerkProvider, QueryProvider, ApiAuthBridge), (chat)/ routes, sign-in, sign-up, proxy.ts (Clerk)
src/contracts/           vendored contracts (read-only)
src/services/            api-client.ts, chats.ts, messages.ts, runs.ts, attachments.ts, credits.ts, config.ts, search.ts, waitpoints.ts
src/queries/             keys.ts + hooks (useChats, useMessages, useSendMessage, useRun, useCancelRun, useCompleteWaitpoint, useConfig, useBalance, useSearch)
src/stores/              ui.ts, composer.ts, runs.ts
src/realtime/            useRunRealtime.ts, liveView.ts (pure reducer: metadata + chunks -> blocks)
src/components/          shell/, sidebar/, messages/ (virtualized list, bubbles), blocks/ (renderers), tools/ (cards), waitpoints/ (overlays), composer/ (input, attachments, media picker), artifacts/, ui/ (shadcn)
src/test/                vitest setup, MSW handlers built from contracts
e2e/                     Playwright
```
