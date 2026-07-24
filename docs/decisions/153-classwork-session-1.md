# 153 — Classwork Session 1 (schema + `/classwork` CRUD)

**Date:** 2026-07-24
**Module:** classwork
**Tracker session:** Session 1

## Built

- Migration `20260724220000_ppp_classwork_v1.sql` applied (hosted): `courses` + `assignments`, RLS via `app_is_owner` / `app_has_module_read('classwork')`, GRANTs, `set_updated_at` + audit triggers, partial indexes, `module_registry` row `classwork`.
- Types regenerated (`src/lib/types/database.ts`).
- `/classwork` list: `?group=date|course` + course filter (URL source of truth); overdue date buckets first; course + assignment Sheets.
- Status axis `not_started` / `in_progress` / `done` with app-stamped `completed_at`.
- `parent_id` same-course + cycle guard; milestone order by `due_date` (A1).
- `courses.project_id` picker suggests Education subtree, does not hard-block (C2).
- Nav: desktop sidebar keeps all modules + Classwork; **mobile tab bar** = Dashboard, Tasks, Invoicing, Library, Classwork (Sermons + Projects desktop-only).
- Permissions slug `classwork`; audit `_CLASSWORK_TABLES` + soft-delete revert + module filter.
- Unit tests: `src/lib/classwork/__tests__/classwork.test.ts` (grouping, days-until, parent picker).

## Decided

- **Mobile nav trim** — drop Sermons + Projects from the mobile tab bar (stay on desktop sidebar) so Classwork fits without an 8th tab.
- **C2** — Education suggest-only for `project_id` (not a hard constraint).
- **A1** — order under a parent by `due_date`; keep `sort_order` in schema, no sort UI in v1.
- Course soft-delete blocked while live assignments remain; assignment soft-delete blocked while live children remain.

## Schema changes

- `20260724220000_ppp_classwork_v1.sql` — `courses`, `assignments`, registry insert.

## New components / patterns added

- `src/lib/components/course-form-sheet.svelte` — course create/edit Sheet.
- `src/lib/components/assignment-form-sheet.svelte` — assignment create/edit Sheet.
- `src/lib/classwork/` — types, parent-picker (client-safe), server loaders/actions.
- Layout split: `desktopNavItems` vs `mobileNavItems`.

## Open questions surfaced

- C1 syllabus/link storage — still deferred until first syllabus (~late Aug).
- A2 time-of-day deadlines — still deferred.
- Owner: confirm audit_log row + mobile glance after first UI write (MCP SQL is read-only here).
- Weekly R2 backup dump does not yet include `courses` / `assignments` — fold into backup.yml when convenient (ops follow-up, not Session 2).

## Surprises (read these before the next session)

- Decision **152** was taken by a parallel essay-author session — this record is **153**.
- Importing `parentPickerOptions` from `server/loaders` into a Sheet fails the client boundary — extracted to `src/lib/classwork/parent-picker.ts`.
- Viewer write remains solo-waivered (Phase 0); SELECT path is wired for `app_has_module_read('classwork')`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] tracker Session 1 done
- [x] PLAN.md refreshed (+ Session 2 prompt)
- [ ] new env vars — none
