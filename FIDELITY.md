# Fidelity spec: cloning app.magica.com (Galaxy Agent Chat)

The brief grades cloning fidelity at 20%: "spacing, empty states, transitions, loading states, and copy ... if something looks roughly the same but isn't pixel-accurate, it counts against you." This file is the measured target. Every number below was read from the live product on 2026-09-21 with DevTools (viewport 1470×759 CSS px, DPR 2). Screenshots (2× scale, so divide pixel positions by 2 for CSS px) live in `/Users/emoha/project-cosmic/screenshots/`:

- `galaxy-reference-empty.jpeg`: new-task (empty) state
- `galaxy-reference-chat.jpeg`: a conversation with an artifact panel open on the right
- `galaxy-reference-tools.jpeg`: a conversation with a user message, "Completed N steps" headers, a failed-response card and a credits footer
- `prod-first-send.jpeg`: OUR app before this pass (for contrast)

Rule of thumb: when this file and the screenshot disagree, the screenshot wins; when both are silent, keep what shadcn gives you and stay minimal. Do not add features the reference has that we do not implement (Projects, Unfair Advantage, Dictation, Connect apps, Fork, thumbs up/down): leave the slot empty rather than shipping a dead control. Keep every control the brief requires (attachments, media picker, plan mode, OpenRouter Free status, send, stop/interrupt, Retry on failed turns, artifact panel) but style it the reference way.

## Tokens (already in `src/app/globals.css`)

| Token | Value | Where it came from |
|---|---|---|
| font | Geist (next/font) 14px / 20px line-height on `body` | reference uses a proprietary geometric sans "magicaCircular" at 14px/20px; Geist is the closest we ship |
| `--foreground` | `#1b1b1b` | body text |
| `--muted-foreground` | `#585858` | section headers, secondary text, icon buttons |
| `--text-subtle` | `#777777` | failed-card copy |
| `--border` / `--input` | `#ededed` | every hairline (sidebar card, cards, pills; the credits pill uses 0.5px) |
| `--muted` / `--accent` / `--surface-hover` | `#f4f4f4` | user bubble, selected recent task, hover rows |
| `--card` / `--secondary` | `#fafafa` | failed card, credits pill, send button (disabled), composer gradient start |
| `--background` | `#ffffff` | page and sidebar |
| `--radius` | 10px | model selector, failed card, artifact card; pills are 999px; user bubble 16px; composer 24px; Retry 4px |
| `--sidebar-width` | 15.5rem (248px) | sidebar card incl. 8px inset |
| `--topbar-height` | 3.25rem (52px) | top bar at y=8 with 8px top margin |
| `--composer-max-width` | 56.25rem (900px) | composer card |
| `--message-max-width` | 54.25rem (868px) | message column, centered in the main area |
| `--user-bubble-max-width` | 28rem (448px) | `max-w-md` on the reference |
| `--artifact-panel-width` | 36rem | reference panel is ~45% of the window |

## Shell (owner: f3-shell)

Layout: the sidebar is a **card** inset 8px from the window edge (top/left/bottom), white, 1px `--border`, ~16px radius, 248px wide including the inset; the main column starts at x=256. Top bar: 52px tall, padding `8px 24px 8px 16px`, white, no bottom border; left: model selector; right: a "files" icon button (folder) that opens the artifact panel, then the credits pill. Main area: white. Artifact panel: right side, full height, 1px left border, header row with icon + title on the left and reload / maximize / close icon buttons on the right (see `galaxy-reference-chat.jpeg`).

Sidebar contents, top to bottom (see `galaxy-reference-empty.jpeg`):
1. Header row: wordmark "Agent Chat" (18px/600, letter-spacing tight) at left; at right two 32px icon buttons: search (⌘K) and collapse sidebar (⌘B). Both shortcuts must work.
2. Nav list, 34px rows, `padding 0 8px`, 14px text `--foreground`, 18px lucide icons in `--muted-foreground` 10px before the label, 10px radius, hover `--surface-hover`. Items and destinations: **New task** (link to `/`), **Tasks** (link to `/`, the chat list = our "recent"), **Library** (opens the media library picker dialog), **Tools** (opens a small dialog listing `config.tools` labels + descriptions), **API / MCP** (external link to the hosted docs URL from `NEXT_PUBLIC_DOCS_URL`, fallback `https://agent-chat-backend-tan.vercel.app/api/v1/health`), **Help & Support** (`mailto:` from `NEXT_PUBLIC_SUPPORT_EMAIL`, fallback hidden). Skip Projects and Unfair Advantage (no equivalent).
3. Section header **"Recent tasks"** 12px `--muted-foreground`, 16px above the list; then the chat list (34px rows, 14px, truncated to one line with ellipsis; selected row `--surface-hover` with 10px radius and a "..." actions button at the right; actions: rename, pin, delete as today). Empty copy: "No tasks yet."
4. Bottom: a **"More"** row (kebab icon + "More", 34px) then the **user card**: 1px border, 12px radius, 34px tall content, 24px avatar circle with the initial on the left, name 13px/500 on the right. Clicking opens the Clerk user menu (`UserButton`).
5. Collapsed state (⌘B): 64px rail with icons only, tooltips on hover; the top bar gets an "open sidebar" button at the far left.

Empty state (`/`, see `galaxy-reference-empty.jpeg`): centered column, 448px wide: a 48px mark (use the app's logo mark or a simple 48px rounded square with the wordmark initial), the current local time "3:07 pm" (13px, muted, `pm` superscript), h1 **"Your AI worker"** 24px/700, subtitle **"Work at the speed of thought."** 14px/500 `--muted-foreground`, then the composer card (900px, placeholder "Assign a task or ask anything..."). Below the composer: a row of pill tabs ("All", "Image & Editing", "Video") and a 3-column grid of suggestion cards (rounded 16px, 1px border, aspect ~4:5, title at the bottom) that fill the composer with a prompt: "Generate an image", "Crop a photo", "Merge two videos", "Ask anything". No stock photos: use a soft gradient background per card.

Credits: the pill and every credits label use the reference format: microcredits ÷ 1,000,000 → `28.45M`; below 0.01M show `<0.01M`. Add `formatCredits(microcredits: number): string` in `src/lib/format.ts` and use it everywhere (sidebar, top bar, message footers via the conversation slice's import).

Model selector (top bar left): 28px tall, radius 10px, padding `4px 8px`, 14px: a 16px status dot (green available / amber degraded / red unavailable / grey unknown) + "OpenRouter Free" + chevron; opens a popover with the model list from `config.models` and the status label. This replaces the status pill inside the composer.

## Conversation (owner: f4-conversation)

Message column: 868px max, centered; 24px between messages; the list scrolls, the composer is pinned at the bottom (already true).

User message (`galaxy-reference-tools.jpeg`): right-aligned bubble, `--muted` background, 16px radius, `padding 6px 16px`, max-width `--user-bubble-max-width`, 14px/20px `--foreground`. Below it, right-aligned and only on hover: the time "13:53" (12px muted) and a copy icon button. Attachments render above the bubble as today.

Assistant message: **no bubble**. Prose 16px/28px `--foreground`, max-width 868px; markdown as today. Structure top to bottom:
1. Step group header: **"Completed N steps"** (14px, `--muted-foreground`, 8px below the previous element) that toggles a list of step rows; while running the header reads "Working…" with a subtle pulse; a run with zero tool calls shows no header.
2. Step rows: 32px, 14px: 16px icon, tool label (e.g. "Crop image", "Generate image", "Merge videos", "Skill"), then the skill name or a short input summary in `--muted-foreground`, then the duration right-aligned ("4.1s", "362ms"). Clicking a row expands the existing tool card (inputs, outputs, credits, error) beneath it. Failed rows get a red-tinted icon; cancelled rows are struck through; running rows show a spinner.
3. Prose blocks (text, thinking, reasoning, citations) in order.
4. Artifact card for generated assets: 1px `--border`, 10px radius, `padding 16px`, 40px thumbnail or icon at left, title (16px/500) + subtitle (14px muted) in the middle, an action link at the right ("View", "Download"); clicking opens the artifact panel.
5. Failed turn: a card with `--card` background, 1px `--border`, 10px radius, `padding 10px 16px`, `gap 10px`: a 16px info-circle icon, the safe error message from the `error` block in `--text-subtle` 14px (fallback "Agent failed to complete this response. Please try again."), and a **Retry** button at the far right: 12px/500 `--muted-foreground`, white, 1px `--border`, 4px radius, `padding 4px 12px`. Cancelled turns: same card, copy "Response cancelled.", no Retry.
6. Footer: "◎ 0.15M credits" (12px `--muted-foreground`, coin icon) from the run's charged microcredits via `formatCredits`; then an icon row (copy) and the time "14:28" (12px). The usage block (model, tokens) moves into a tooltip on the credits label; do not render "unknown · 0 tokens".

Composer (`galaxy-reference-empty.jpeg` bottom): card 900px max, 24px radius, 1px `--border`, background gradient `--card` → white, `padding 16px 16px 12px`, `gap 12px`. Row 1: the textarea, placeholder "Send a message..." (empty state: "Assign a task or ask anything..."), 14px, no visible border, auto-grows to 70vh. Row 2: left group of 32px round icon buttons `--muted-foreground`: attach (paperclip), media library (image icon), plan mode (toggle; active state `--foreground` on `--muted`); right group: the character counter only when above 90% of the limit (12px muted), then the send button: 32px circle, `--card` background with a `--muted-foreground` arrow-up when disabled, `--foreground` background with white arrow when enabled; while a run is active the same slot shows the **Stop** button (32px circle, `--foreground` background, white square icon). Attachment chips stay above row 2 inside the card. Remove the "Community plan" line; put that sentence in the attach button's tooltip.

Waitpoint overlays: keep the current behaviour; restyle to 10px radius, 1px border, white, 24px padding, title 16px/600, body 14px, buttons like Retry (secondary) and the primary black pill.

## Both slices

- Accessibility stays: labels, roles, focus rings (`--ring`), `aria-live` regions, keyboard shortcuts.
- Responsive: below `md` the sidebar becomes the Sheet, the top bar shows the open-sidebar button, the composer goes full width with 16px gutters, user bubbles max 85%.
- No new dependencies. lucide icons only.
- Tests: update the existing RTL tests for renamed copy/labels and add one test per new component (nav, top bar, empty-state suggestions, step group, failed card, credits format). `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
