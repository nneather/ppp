# 109 — Tasks active badge + recurring tasks

**Date:** 2026-07-21
**Module:** projects
**Tracker session:** ad-hoc

## Built

- Dashboard Tasks tile shows **Critical** and **Opportunity** open counts only (MYN-visible: `start_date ≤ today`); zones with 0 are omitted; Over the Horizon is never shown.
- Recurring tasks (Outlook-like weekly/monthly) on `/tasks` create sheet: frequency, interval, weekday chips / month day, end never / after N / on date.
- Schema: `project_task_series` template + `project_tasks.series_id` / `series_occurrence`.
- **Complete → spawn next** occurrence from series template (one open instance; next may be deferred).
- Edit/delete of series-linked tasks: **This task** vs **Entire series** dialogs.
- Soft-delete this occurrence skips forward (spawns next); entire series sets `stopped_at` and deletes the open instance.
- Uncomplete soft-deletes later open siblings and rewinds `occurrence_seq`.
- Pure helpers + unit tests: `src/lib/projects/task-recurrence.ts`.
- Audit log: `project_task_series` in Projects module + soft-delete revert whitelist.

## Decided

- **1A:** No pre-materialized window — spawn only the next occurrence on complete (or skip-delete).
- **2B:** Outlook-style This task / Entire series on edit and delete (not “this only forever”).
- Weekly/monthly only in v1 (no daily/yearly/nth-weekday).
- Series template owns title/project/priority/notes/rule for future spawns; “This task” may diverge for the current instance only.
- ISO weekdays `1=Mon…7=Sun` for `byweekday`.

## Schema changes

- `supabase/migrations/20260721231503_project_task_recurrence.sql` — `project_task_series` + task FK columns + indexes + RLS/audit/grants.

## New components / patterns added

- `src/lib/projects/task-recurrence.ts` — rule parse/validate, `nextStartDate`, `seriesHasEnded`, summary text.
- Recurrence UI embedded in `project-task-sheet.svelte`; scope dialogs in sheet + `project-task-list.svelte`.

## Open questions surfaced

- None blocking.

## Surprises (read these before the next session)

- PostgREST column name `interval` is fine; keep it quoted in raw SQL if ever hand-written outside migrations.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] MYN_TASKS_DESIGN.md note
- [x] PLAN.md refreshed
- [ ] new env vars — n/a
