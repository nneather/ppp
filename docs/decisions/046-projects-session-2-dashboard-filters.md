# 046 — Projects Session 2: dashboard glance + filters

**Date:** 2026-06-03
**Module:** projects
**Tracker session:** Session 2

## Built

- `/dashboard` **Project status** strip — domains with latest health + week-over-week trend arrows; expand/collapse children; `—` when no update; domain rows deep-link to `/projects?domain=…`.
- Projects module tile — **active project count** + footer **Attention: N** deep-linking `/projects?health=attention`.
- `loadLatestHealth` — single flat query on `project_updates`, reduced to latest + previous per project.
- `/projects` URL-synced filters — lifecycle chips (default `{active, paused, idea}`), health select (incl. `attention`), domain select; back/forward round-trips.
- Per-row **HealthTrendBadge** on the tree (latest health + trend); filters are **visual-only** — Save still snapshots all active+paused nodes.
- Migration `20260603200000_projects_add_not_started_lifecycle.sql` — new `not_started` lifecycle status.
- Pure helpers in `src/lib/projects/filter.ts` + unit tests.

## Decided

- **D1 lifecycle filter:** default visible = `{active, paused, idea}`; `done`, `archived`, `not_started` revealed via chips. Check-in sweep unchanged (`active`+`paused` only).
- **Filters visual-only:** draft seeding uses full tree; filtering only affects render (`computeVisibleNodeIds`).
- **Current health = latest update** (most recent `week_of`), not current calendar week.
- **Trend:** compare last two updates on `HEALTH_STATUS_ORDER` rank (lower index = better → up arrow).
- **`not_started` lifecycle** added (hidden by default in filter chips).

## Schema changes

- `supabase/migrations/20260603200000_projects_add_not_started_lifecycle.sql` — extend `projects_lifecycle_status_check`.

## New components / patterns added

- `src/lib/components/health-trend-badge.svelte` — health dot + trend arrow / em dash.
- `src/lib/components/project-status-strip.svelte` — read-only dashboard domain strip.
- `src/lib/components/dashboard-projects-tile-footer.svelte` — attention count deep link.
- `src/lib/components/project-filter-bar.svelte` — URL-synced lifecycle/health/domain controls.
- `src/lib/projects/filter.ts` — parse filters, attention set, trend direction, visible-node computation.

## Open questions surfaced

- None new; D1 resolved.

## Surprises

- Dashboard load is 6 Supabase round-trips (was 4) — acceptable for glance page; documented here per performance rule.
- Domain filter uses root name match (`Education`, `Work`, etc.) — same as seeded domain rows.

## Carry-forward updates

- [x] `components.mdc` updated
- [ ] `AGENTS.md` inventory updated (optional — filter helpers)
- [x] new env vars documented (none)
- [x] tracker Session 2 marked done
