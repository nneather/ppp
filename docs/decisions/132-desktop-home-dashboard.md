# 132 — Desktop home dashboard

**Date:** 2026-07-23
**Module:** projects (+ sermons glance)
**Tracker session:** Ad-hoc — desktop `/dashboard` home

## Built

- **`/dashboard` desktop (`md+`) two-column home** — left: project status strip, optional week check-in nudge, compact invoicing/library cards, upcoming sermons; right: sticky **Now** pane (Critical + Opportunity only) with complete/defer/promote/raise/edit + New Task sheet.
- **Mobile / PWA glance** — same route, no embedded task list; Tasks tile shows Critical/Opportunity counts and links to `/tasks`; status + sermons + invoicing/library cards remain.
- **Upcoming sermons** — `loadUpcomingSermons` (`preached_on >=` Chicago today, asc, limit 5) + `<DashboardUpcomingSermons>`.
- **Check-in nudge** — `countMissingWeekCheckIns` when active/paused projects lack current Chicago Sunday `week_of` update.
- **Task actions on dashboard** — same `?/createTask`… helpers as `/tasks`; `depends('app:projects:tasks')`.
- **`ProjectTaskList` `compact` prop** — tighter headers/rows; hides start-date line on dashboard.

## Decided

- **Layout 1A + mobile 2B** — desktop Outlook-style Now column; mobile must not mount the full/compact task list (counts tile only).
- **Now pane = Critical + Opportunity only** — OTH, deferred, saved views, soft-cap “show all” stay on `/tasks`.
- **Upcoming = `preached_on >= today`** — schedule-ahead rows; empty state links to `/sermons`.
- **No schema migration** — loaders + UI + form actions only.
- **Same `/dashboard` route** — responsive split; PWA `start_url` unchanged.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/dashboard-upcoming-sermons.svelte`](../../src/lib/components/dashboard-upcoming-sermons.svelte) — upcoming sermon list panel.
- [`loadDashboardNowTasks`](../../src/lib/projects/server/task-loaders.ts) — Critical/Opportunity visible tasks for the desktop pane.
- [`loadUpcomingSermons`](../../src/lib/sermons/server/loaders.ts) + `DashboardSermonRow` type.
- [`countMissingWeekCheckIns`](../../src/lib/projects/filter.ts) — dashboard check-in nudge.

## Open questions surfaced

- None blocking. Optional later: deep-link sermon row to open edit Sheet on `/sermons`.

## Surprises (read these before the next session)

- Dashboard `load` is now **~11 parallel Supabase round-trips** (unbilled count, last-week entries, 2 library counts, tree, latest health, Now tasks, upcoming sermons, flat project rows, profile default, then series-by-ids). Documented exception to the ≤4 budget (same pattern as 046/059); all are indexed / head or bounded selects.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] PLAN.md refreshed
