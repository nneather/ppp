# 053 — UX safety + first impressions (review 051, Session R3)

**Date:** 2026-07-06
**Module:** cross-module
**Tracker session:** Review remediation R3

## Built

- **Login rebuilt to the design system** ([`src/routes/login/+page.svelte`](../../src/routes/login/+page.svelte)): shadcn `Input` / `Label` / `Button`, associated `<Label for>` on both fields, branded card (border/`bg-card`/shadow), `role="alert"` error surface, `hotkey="s"` on submit. Now a real `<form onsubmit>` so Enter submits; `autocomplete="email"` / `current-password`. No inline `style=` remains.
- **Root branded error page** ([`src/routes/+error.svelte`](../../src/routes/+error.svelte)): status-aware title (404 → "Page not found", 403 → "Not allowed", 401 → "Sign in required", else generic), message from `page.error`, "Go to dashboard" link. Replaces the default SvelteKit error page for 403/404/500.
- **`/settings/permissions` owner gate is now graceful** ([`+page.server.ts`](../../src/routes/settings/permissions/+page.server.ts) + [`+page.svelte`](../../src/routes/settings/permissions/+page.svelte)): non-owners get an inline "Owner-only page" card instead of a bare `error(403)`. Page chrome (header, back link) still renders.
- **Book delete now goes through `<ConfirmDialog>`** ([`src/routes/library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte)): both the desktop toolbar and the mobile actions sheet triggers open a shared confirm dialog that drives a hidden `?/softDeleteBook` form via `requestSubmit()` — same pattern already used for scripture-ref + topic deletes on the same page. Previously delete fired immediately with no confirmation.
- **Dashboard Tasks tile** ([`dashboard/+page.svelte`](../../src/routes/dashboard/+page.svelte) + [`+page.server.ts`](../../src/routes/dashboard/+page.server.ts)): new `/projects/tasks` tile showing a live "Open Critical Now tasks" count (one lean `head`+`count` query: `priority = critical_now`, not deleted, not completed, `start_date <= today` Chicago).

## Decided

- **Confirm-gated delete triggers are de-emphasized `variant="outline"` + `text-destructive`, no `hotkey`; the `<ConfirmDialog>` carries `hotkey="d"`.** Matches the established settings pattern (e.g. `/settings/library/series`). Rejected keeping the trigger `variant="destructive"` with `hotkey="d"`: the confirm button also wires `d`, so both would register the chord while the dialog is open (dev collision warning). `variant="destructive"` triggers would also fire the button dev-warn if left without a hotkey.
- **Dashboard live stat = open Critical Now tasks** (not overdue check-in). A single count query, no extra loader; overdue-check-in would need per-project week math already owned by `/projects`. Dashboard load is now 7 round-trips (was 6) — accepted for the dashboard aggregator; still one lean count, not a full `loadTasks`.
- **Error page links to `/dashboard`, not `/`.** `/` has no route; `/dashboard` is home and cleanly bounces unauthenticated users to `/login` via the existing guard.

## Schema changes

- None.

## New components / patterns added

- [`src/routes/+error.svelte`](../../src/routes/+error.svelte) — first error boundary in the repo; branded, status-aware. Reuse/extend rather than adding nested `+error.svelte` unless a route needs bespoke recovery.
- Pattern: **graceful owner/permission gate** — return `{ notOwner: true, … }` from `load` and render an inline card, instead of `error(403)`. Reuse for future owner-only surfaces.

## Open questions surfaced

- Dashboard mobile-width screenshot deferred to owner phone smoke (dev server points at prod Supabase; no owner session available in-session). Login mobile screenshot captured.

## Surprises (read these before the next session)

- `/dashboard` load was already at 6 Supabase round-trips (over the ≤4 performance-rule budget) before this session — the dashboard is the documented aggregator exception. The new tile adds a 7th (lean count).
- The book detail page already had two full `<ConfirmDialog>` instances (scripture refs, topics) plus hidden-form + `requestSubmit()` plumbing — the book delete just adopts the same shape; no new component needed.

## Carry-forward updates

- [x] components.mdc updated (root `+error.svelte` row added)
- [x] AGENTS.md inventory updated (error page + graceful-gate pattern)
- [x] new env vars documented (none)
- [ ] tracker Open Questions updated (dashboard screenshot deferred — noted in PLAN.md)
