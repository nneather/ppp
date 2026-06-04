# 047 — Projects Session 3: MYN tasks + links + audit

**Date:** 2026-06-04
**Module:** projects
**Tracker session:** Session 3

## Built

- Migration `20260604030000_ppp_project_tasks_myn.sql` — `project_tasks` with MYN urgency zones (`critical_now`, `opportunity_now`, `over_horizon`), required `start_date`, `completed_at`, soft delete, audit + RLS.
- `/projects/tasks` — unified MYN task page (all projects; `?project=` filter); zone-grouped FRESH sort; show/hide deferred + completed; Promote / Defer / Complete / Edit / Delete.
- `project_links` inline editor in metadata Sheet (edit mode only) — add, update, delete, reorder.
- Audit log: `project_tasks` in Projects filter + soft-delete revert; entity labels `title · zone`.
- Design reference: [MYN_TASKS_DESIGN.md](../MYN_TASKS_DESIGN.md).

## Decided

- **T1 resolved — no `due_date`.** MYN uses **start date** (hide-if-future + FRESH descending sort), not deadlines. Chicago civil today via `ymdInChicago()`.
- **Task surface:** standalone `/projects/tasks` (not tree expand-row, not metadata sheet). Entry: **Tasks** button on `/projects` header.
- **Scope v1:** tasks require `project_id`; global cross-module Now-list deferred (documented in MYN_TASKS_DESIGN.md).
- **Links:** metadata Sheet only; hard delete (no `deleted_at`, mirrors `invoice_line_items`).
- **Reorder:** manual drag dropped; MYN Promote/Defer + `sort_order` tiebreak only.
- **Defer-to-Do vs Defer-to-Review:** same schema — user picks zone + future start date in defer dialog.

## Schema changes

- `supabase/migrations/20260604030000_ppp_project_tasks_myn.sql` — `project_tasks` table + indexes + triggers + RLS + GRANTs.

## New components / patterns added

- `src/lib/components/project-task-list.svelte` — zoned MYN list + defer dialog.
- `src/lib/components/project-task-sheet.svelte` — create/edit task.
- `src/lib/components/project-links-editor.svelte` — links CRUD in project Sheet.
- `src/lib/projects/server/task-loaders.ts` — `loadTasks`, `loadLinksByProject`.
- `src/lib/projects/server/task-actions.ts` — task CRUD + complete/defer/promote.
- Link actions appended to `src/lib/projects/server/actions.ts`.

## Open questions surfaced

- None blocking v1.

## Future (documented, not built)

- Global **Now** view across modules (project-optional tasks).
- Email → task capture (Outlook MYN integration analogue).
- Automated Defer-to-Review (Monday review dates for Over-the-Horizon).
- **Target Now** underline when Normal-priority task's start date is today (Outlook visual).

## Surprises

- Standalone task page is simpler than per-project detail route and matches future global reuse of `project-task-list.svelte`.

## Carry-forward updates

- [x] `components.mdc` updated
- [x] `AGENTS.md` inventory updated
- [x] `MYN_TASKS_DESIGN.md` filed
- [x] tracker Session 3 marked done
- [x] `PLAN.md` updated
