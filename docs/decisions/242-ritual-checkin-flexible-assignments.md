# 242 — Ritual check-in auto-complete + flexible assignments

**Date:** 2026-10-19
**Module:** projects | classwork
**Tracker session:** ad-hoc

## Built

- **Weekly Status ritual auto-complete.** `project_task_series.ritual_kind = weekly_project_checkin` (backfilled to the existing Monday Opportunity Now series). When `countMissingWeekCheckIns` is 0 for the Chicago Sunday week, the open occurrence with `start_date` in that week is completed (and the next Monday spawned) via shared `completeTaskRecord`. Runs after successful check-in save and on owner loads of `/tasks` and `/dashboard`.
- **Assignment list quick actions.** Checkbox complete/reopen, status select (`not_started` / `in_progress` / `done`), and due-date move dialog (Tomorrow / Next Monday / +1 week / custom) on `/classwork`. Dashboard Due soon gets checkbox + due move (posts to `/classwork?/…`). Sheet remains for full edits.

## Decided

- Link ritual by **`ritual_kind` on the series**, not title match — one live series per kind (partial unique index).
- Auto-complete only when the **full** check-in nag set is clear (same rule as the dashboard nudge), including deferred exclusions.
- Completing an assignment does **not** complete a MYN task with `assignment_id` (MCP dedupe only — [184](184-mcp-monday-protocol-finetune.md)).
- Due-date move allows past dates; status is unchanged.
- Reopening Weekly Status while the week is still fully checked in will close it again on the next tasks/dashboard load (task mirrors check-in completion).

## Schema changes

- `20261019155011_project_task_series_ritual_kind.sql` — nullable `ritual_kind` check (`weekly_project_checkin`), partial unique live index, backfill Weekly Status series `3a661f84-d575-4cbf-bfd1-57ee3a15bb44`.

## New components / patterns added

- `src/lib/projects/ritual-checkin.ts` — week window match helpers.
- `src/lib/projects/server/ritual-checkin-reconcile.ts` — reconcile entry point.
- `src/lib/projects/server/task-actions.ts` — `completeTaskRecord` shared by form + ritual.
- `src/lib/classwork/due-presets.ts` — tomorrow / next Monday / +1 week.
- `src/lib/components/assignment-row.svelte` — list + dashboard compact row with quick actions.

## Open questions surfaced

- None blocking. Optional later: mark ritual series from the task sheet UI; deep-link `?assignment=` to open sheet.

## Surprises (read these before the next session)

- Weekly Status already had 13 completed Monday occurrences; open occurrence for the current week may be next Monday (`start_date` still inside or just after the Sunday window depending on when you look — reconcile filters to `[weekOf, weekOf+6]`).
- Hosted migration must be pushed before ritual reconcile finds the series (`ritual_kind` null until apply).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars documented (n/a)
- [ ] tracker Open Questions updated (n/a — ad-hoc)
- [x] `npm run supabase:db:push --include-all` applied (`ritual_kind` backfilled on Weekly Status)
- [ ] `npm run supabase:gen-types` optional polish (types already include `ritual_kind`)
