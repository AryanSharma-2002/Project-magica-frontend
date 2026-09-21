# agent-chat-frontend

Next.js 16 App Router client for the Agent Chat work trial. Pairs with **agent-chat-backend** (REST `/api/v1`, Trigger.dev realtime). Stack: TypeScript strict, Clerk, TanStack Query, Zustand, Zod (vendored contracts), shadcn/ui + Tailwind 4, Uppy + Transloadit (tus), Trigger.dev React hooks, Vitest + RTL + MSW + Playwright.

Live: `https://agent-chat-frontend-pi.vercel.app` (Clerk sign-in), talking to the API at `https://agent-chat-backend-tan.vercel.app`.

Design: see [ARCHITECTURE.md](./ARCHITECTURE.md) and the canonical `agent-chat-backend/ARCHITECTURE.md`.

## Setup

Full run guide for both repos: `agent-chat-backend/RUNBOOK.md`.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local        # Clerk publishable key, backend URL
pnpm contracts:sync ../agent-chat-backend   # or a git URL + ref
pnpm dev                          # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
E2E_CLERK_USER_EMAIL=<reviewer email> pnpm test:e2e   # Playwright smoke against a running stack (see e2e/README.md)
```

## Contracts
`src/contracts/` is a vendored copy of the backend's `packages/contracts/src`, pinned in `contracts.lock.json` and verified by `pnpm contracts:check`. Never edit it by hand.

## Deploy
Vercel. Set `NEXT_PUBLIC_API_URL`, Clerk keys. The backend must allow this origin (`FRONTEND_ORIGIN`).

## Architecture overview

Services (`src/services`) are the only fetch boundary and parse every response with the vendored Zod contracts. TanStack Query owns server state (infinite, cursor-based chats and messages; optimistic send with idempotency keys). Zustand holds small UI caches. During an active run the assistant bubble renders from the live view (Trigger.dev run metadata plus the `agent-text` stream, ordered by block index); when the run finishes the persisted message replaces it, so there is never a duplicate terminal bubble. Realtime failures degrade to bounded reconnects, token refresh and REST polling. Rendering is registry-driven: block type → renderer, tool name → card, waitpoint type → overlay.

## Design decisions and trade-offs

- **Vendored contracts with a lock file** instead of a shared npm package: works on Vercel and a fresh clone with no registry auth; `pnpm contracts:check` in CI stops hand edits.
- **Live view vs persisted view as an explicit switch** rather than merging streams into the cache: simpler invariants, no duplicate bubbles, replay from index 0 is idempotent.
- **Prop-driven seams** (`Composer`, `WaitpointOverlay`, `ToolCard`, `ArtifactPanel`) so the composer/uploads/overlays evolve independently of page composition.
- **Backend-owned limits** read from `GET /config`: the client never hardcodes message or upload limits.
- **`exactOptionalPropertyTypes` off** on the frontend only: it conflicts with Radix/shadcn prop types and would force casts.

## What I'd improve with more time

- Pixel pass against the reference product with side-by-side screenshots (tokens are isolated in `globals.css` for this).
- Persist the composer draft and pending uploads to IndexedDB so a reload mid-upload can resume via tus.
- Prefetch the next page of messages on scroll intent and virtualize the sidebar list.
- Playwright coverage for reload recovery and reconnect using a stubbed realtime transport.
