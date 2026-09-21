# Playwright smoke suite

`pnpm test:e2e` runs `e2e/*.spec.ts` against an already running stack: the frontend at `PLAYWRIGHT_BASE_URL` (default `http://localhost:3000`), the backend that frontend is configured for, and that backend's Trigger.dev worker. Nothing is mocked.

Required environment (read from `.env.local`, `.env.e2e.local` or the shell):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | `@clerk/testing` mints a testing token and a sign-in ticket for the reviewer account (development instance only) |
| `E2E_CLERK_USER_EMAIL` | the reviewer account, e.g. the address in RUNBOOK §9b |
| `PLAYWRIGHT_BASE_URL` | optional; point it at the deployed frontend to run the suite against production |

```bash
npx playwright install chromium                                  # once
E2E_CLERK_USER_EMAIL=reviewer@example.com pnpm test:e2e           # desktop + mobile projects
pnpm exec playwright test --project desktop --grep "shell"        # a subset
pnpm exec playwright show-report                                   # after a CI run
```

What it covers: sign-in (ticket-based, no password), sidebar navigation, top bar, empty state, suggestion cards, ⌘K search, ⌘B collapse, the Tools dialog, sending a message and reaching a terminal state, reload recovery, and the mobile layout. The send test spends one OpenRouter free-tier request and accepts either a completed or a failed turn, so it stays green when the free router's 50-requests-per-day cap is exhausted. The auth state is cached in `e2e/.auth/` (gitignored).
