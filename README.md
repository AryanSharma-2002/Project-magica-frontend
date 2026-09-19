# agent-chat-frontend

Next.js 16 App Router client for the Agent Chat work trial. Pairs with **agent-chat-backend** (REST `/api/v1`, Trigger.dev realtime). Stack: TypeScript strict, Clerk, TanStack Query, Zustand, Zod (vendored contracts), shadcn/ui + Tailwind 4, Uppy + Transloadit (tus), Trigger.dev React hooks, Vitest + RTL + MSW + Playwright.

Design: see [ARCHITECTURE.md](./ARCHITECTURE.md) and the canonical `agent-chat-backend/ARCHITECTURE.md`.

## Setup

```bash
corepack enable pnpm
pnpm install
cp .env.example .env.local        # Clerk publishable key, backend URL
pnpm contracts:sync ../agent-chat-backend   # or a git URL + ref
pnpm dev                          # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e                     # Playwright (needs backend + Clerk test user)
```

## Contracts
`src/contracts/` is a vendored copy of the backend's `packages/contracts/src`, pinned in `contracts.lock.json` and verified by `pnpm contracts:check`. Never edit it by hand.

## Deploy
Vercel. Set `NEXT_PUBLIC_API_URL`, Clerk keys. The backend must allow this origin (`FRONTEND_ORIGIN`).
