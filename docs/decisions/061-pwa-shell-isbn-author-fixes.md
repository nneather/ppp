# 061 — PWA shell + ISBN author fixes

**Date:** 2026-07-06
**Module:** library + cross-cutting (PWA)
**Tracker session:** ad-hoc

## Built

- **Service worker navigation fallback** — [src/service-worker.ts](../../src/service-worker.ts): `NavigationRoute` + `NetworkOnly` (10s timeout) so failed/hung document navigations reach `setCatchHandler` → precached `offline.html` (SW v5). No HTML caching.
- **Library settings mobile layout** — [src/routes/settings/library/+layout.svelte](../../src/routes/settings/library/+layout.svelte): horizontally scrollable tab strip; added missing **Publishers** tab; shell `overflow-x-hidden` on `<main>` in [+layout.svelte](../../src/routes/+layout.svelte).
- **Sticky save bars** — [book-form.svelte](../../src/lib/components/book-form.svelte), [scripture-reference-form.svelte](../../src/lib/components/scripture-reference-form.svelte): `sticky bottom-0` (removed stale `max-md:bottom-tabbar` double-offset from pre-045 fixed tab bar). Root `<main>` padding `pb-4` on mobile (tab bar is flex footer, not overlay).
- **Review queue action bar** — [review/+page.svelte](../../src/routes/library/review/+page.svelte): mobile actions sticky in-flow instead of `fixed bottom-tabbar` (iOS PWA keyboard detach).
- **ISBN author auto-create** — unresolved Open Library author rows submit `{ name, role, sort_order }` in `authors_json`; [book-actions.ts](../../src/lib/library/server/book-actions.ts) resolves via `findOrCreatePerson` before `syncAuthors`. Form shows "Will be created when you save" hint.
- **OL fetch timeout** — [open-library-prefill.ts](../../src/lib/library/open-library-prefill.ts): `AbortSignal.timeout(8s)` on edition/work/author fetches; degrades to `by_statement` fallback.
- **Tests** — [book-actions-authors.test.ts](../../src/lib/library/server/__tests__/book-actions-authors.test.ts) (4 cases).

## Decided

- **061 not 059** — `059-dashboard-last-week-invoice.md` already filed same day; this ad-hoc PWA fix is **061**.
- **Auto-create at save** (owner pick) — fastest scan flow; B14 dedup in `findOrCreatePerson` links near-matches; merge suggestions catch stragglers.
- **`bottom-tabbar` scope** — fixed toasts/FABs only; sticky in-flow chrome uses `bottom-0` inside the scrollport.

## Schema changes

- None.

## New components / patterns added

- `AuthorFormEntry` type + `parseAuthorsJsonString` name branch in `book-actions.ts`.
- SW pattern: `NavigationRoute(NetworkOnly)` → `setCatchHandler` for offline shell without caching SSR HTML.

## Open questions surfaced

- **Endless nav skeleton** — if it persists after SW update + icon re-add, capture Safari remote inspector on `/settings/library` load (may be separate from offline fallback).

## Surprises

- `setCatchHandler` alone is insufficient without a matching route — Workbox only invokes catch handlers when a registered strategy throws ([057](057-pwa-consistency.md) offline page never showed in airplane mode until this fix).
- `max-md:bottom-tabbar` on **sticky** bars was a leftover from when the tab bar was `position: fixed` on a document-scrolling page ([045](045-projects-session-1-tree-checkin.md)).

## Carry-forward updates

- [x] AGENTS.md mobile shell guidance updated
- [x] app.css utility comments updated
- [ ] components.mdc — no new components
- [ ] Owner phone smoke: settings tabs scroll; offline page on airplane mode; add-book save bar flush; ISBN save creates authors

## Verification

- [x] `npm run check` — 0 errors (2026-07-06)
- [x] `npm run test` — 144/144 green
- [ ] Owner PWA: Update now after deploy; re-test settings, offline, save bar, ISBN authors
