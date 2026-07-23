# 128 — Fall MYN polish

**Date:** 2026-07-23
**Module:** projects
**Tracker session:** Ad-hoc — fall polish from [126](126-myn-fall-backlog-lock.md)

## Built

- **Profile prefs** — `profiles.default_task_project_id` + `profiles.task_saved_views` (JSONB array). Migration `20260723170000_profiles_task_prefs.sql`.
- **Settings** — `/settings/projects`: default New Task project + named views CRUD (include / exclude / only). Hub card on `/settings`.
- **`/tasks`** — applies `?view=` (named presets) or `?project=` (explicit wins); New Task uses filter project else profile default; soft-cap banner at ≥50 with `?all=1` Show all.
- **Soft-cap 50 total** — truncate hides lowest priority first, then oldest `start_date`; per-zone “over cap” UX removed (classic 5/20 kept as methodology constants only).
- **Target Now** — Opportunity Now + `start_date = today` → badge + underline + row tint.
- **Defer** — presets Tomorrow / Next Monday / +1 week; “Defer to Monday (OTH)” one-click in dialog.

## Decided

- Named views managed under **`/settings/projects`**; `/tasks` only picks via URL (`?view=`).
- Show all is **session-only** (`?all=1`), not a profile sticky.
- Soft-cap is **global 50** across zones, not per-zone.

## Schema changes

- `20260723170000_profiles_task_prefs.sql` — `default_task_project_id` FK → `projects(id)` ON DELETE SET NULL; `task_saved_views jsonb` array CHECK.

## New components / patterns added

- `src/lib/projects/task-views.ts` — parse/resolve views + soft-cap truncate (client-safe).
- `src/lib/projects/server/task-prefs-actions.ts` — profile default + view upsert/delete.
- `src/lib/invoicing/chicago-date.ts` — `nextMondayYmdChicago`, `addDaysYmd`.
- Route: `src/routes/settings/projects/`.

## Open questions surfaced

- None blocking.

## Surprises (read these before the next session)

- Decision number **127** was already used by IVP publisher backfill; this session is **128**.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] PLAN.md + MYN_TASKS_DESIGN.md refreshed
