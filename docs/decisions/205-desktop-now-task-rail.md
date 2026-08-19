# 205 — Desktop Now task rail

**Date:** 2026-08-19
**Module:** projects
**Tracker session:** Ad-hoc — persistent desktop tasks

## Built
- **Desktop Now rail** — Critical + Opportunity list sits between the module nav and page content on `md+`, on every authenticated route except `/tasks` (the full list). Complete / defer / promote / raise / edit / New work from the rail.
- **`GET /tasks/now.json`** — authenticated, `Cache-Control: private, no-store`. Layout does not load tasks on every navigation (mobile PWA would pay that tax). Desktop mounts `<DesktopTaskRail>` after a `min-width: 768px` match and fetches the JSON.
- **Dashboard** — drops the right-column Now pane (duplicate). Mobile glance tile + counts stay. Due soon + Due to meet remain the desktop right column. Task form actions live only on `/tasks`; the rail posts there via `actionPrefix`.

## Decided
- **Persistent left rail, not dashboard-only** — “always available” means visible while working in library / classwork / invoicing, not a column swap on `/dashboard`.
- **Hide on `/tasks`** — avoid two lists and two New-task sheets.
- **Mobile unchanged** — no rail, no bits-ui in the root layout bundle (dynamic import, desktop-only mount). Tab bar still links to `/tasks`.
- **JSON endpoint instead of layout `load`** — root layout already re-runs on every URL change (auth `url.pathname`). Putting Now queries there would add 3+ round-trips to every SPA navigation, including phone. Documented exception: `/tasks/now.json` is 3 parallel queries + series-by-ids ([performance.mdc](../../.cursor/rules/performance.mdc) ≤4).
- **Rail New has no hotkey** — `/library` New Book keeps `b`; a always-visible primary New would collide.

## Schema changes
- None.

## New components / patterns added
- [`src/lib/components/desktop-task-rail.svelte`](../../src/lib/components/desktop-task-rail.svelte) — compact Now list + sheet; dynamic-imported from root layout.
- [`src/lib/projects/now-task-rail.ts`](../../src/lib/projects/now-task-rail.ts) — client-safe type, JSON path, `taskFormAction`, payload guard.
- [`loadNowTaskRail`](../../src/lib/projects/server/task-loaders.ts) — Now zones + domain colors + domain-root project options + series.
- `actionPrefix` on `<ProjectTaskList>` / `<ProjectTaskSheet>` — cross-page posts skip `update()` and refresh via callback (same pattern as dashboard generate → `/invoicing/invoices?/generate`).

## Open questions surfaced
- None blocking. Optional later: collapse the rail independently of the module nav on mid-width laptops.

## Surprises (read these before the next session)
- SvelteKit form actions cannot live on layouts. The rail must POST to `/tasks?/…` and must **not** call default `update()` (that applies `/tasks` form state onto the current page).
- Do not add bits-ui to [`+layout.svelte`](../../src/routes/+layout.svelte) — keep the rail behind `import()`.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] PLAN.md refreshed
