# 045 — Projects Session 1: tree + weekly check-in

**Date:** 2026-06-03
**Module:** projects
**Tracker session:** Session 1

## Built

- Migration `20260603170000_ppp_projects_v1.sql` — `projects`, `project_updates`, `project_links`; partial unique on `(project_id, week_of)`; Sunday `week_of` CHECK; four root domains seeded; RLS via `app_is_owner` / `app_has_module_read('projects')`; explicit GRANTs.
- `/projects` inline-editable tree with carry-forward weekly health, week selector (Chicago civil Sunday), batched snapshot save, metadata Sheet (create/edit), soft-delete + undo, delete-with-children block, cycle-safe parent picker.
- `src/lib/projects/` — week math, loaders, actions; types in `src/lib/types/projects.ts`.
- Audit log module filter **Projects** + soft-delete revert for `projects` / `project_updates`.

## Decided

- **Upsert on PK `id`, not `(project_id, week_of)`** — PostgREST `onConflict` cannot target the partial unique index (footgun **NEW-D**). Pre-load week rows (incl. soft-deleted), set `id` + `deleted_at: null` on revive, single `.upsert(..., { onConflict: 'id' })`.
- **`reason` / `next_steps` plain text v1** — no markdown renderer in repo; deferred to Session 3 or shared primitive later.
- **Check-in sweep** — health picker + snapshot save only for `lifecycle_status` ∈ `{ active, paused }`; full tree still visible for parent judgment.
- **Root domains** — seeded rows have `parent_id` null; no edit/delete on roots in UI (create children under them only).

## Schema changes

- `supabase/migrations/20260603170000_ppp_projects_v1.sql` — projects module v1 tables + seed.

## New components / patterns added

- `src/lib/components/project-tree.svelte` — collapsible tree, 5-segment health picker, `untrack()` on carry-forward seed `$effect`.
- `src/lib/components/project-form-sheet.svelte` — metadata Sheet with cycle-safe parent picker.
- `src/lib/projects/week.ts` — Chicago civil Sunday helpers (distinct from invoicing Monday weeks).
- `src/lib/projects/server/loaders.ts` / `actions.ts` — tree load, batched check-in, cycle guard.

## Open questions surfaced

- Dashboard / filters (Session 2, tracker D1) — unchanged.

## Surprises

- Tracker said “upsert on `(project_id, week_of)`” but partial unique indexes are not valid PostgREST `onConflict` targets — runtime `42P10` without PK upsert (NEW-D).
- 2026-06-03 is Wednesday; prior Sunday is **2026-05-31**, not June 1 — test dates must use real weekdays.
- Carry-forward `$effect` seed key omitted the project **tree** — new sub-projects had no health/notes until refresh; fixed by fingerprinting `id:lifecycle` in `dataSeed` (footgun #1 variant).
- Post-create UX: per-row **+** for add-child; **New project** moved to page bottom (header/domain button row removed).
- Second save same week: upsert rows without `id` → `null value in column "id"`; fixed with `randomUUID()` + client `update_id` on every payload row (NEW-D adjunct).
- Draft reseed on tree-only change now **merges** (keeps in-progress edits); full reseed only when week or `weekUpdates` changes.
- Tab bar floating mid-scroll on iOS PWA: `fixed bottom-0` + body scroll → refactored app shell to `h-dvh` + flex footer nav ([`+layout.svelte`](../../src/routes/+layout.svelte)).

## Carry-forward updates

- [x] `components.mdc` updated
- [x] `AGENTS.md` inventory updated (projects helpers + mobile shell)
- [x] `docs/POS_Schema_v1.md` Projects section + RLS/trigger summary rows
- [x] `POS_Projects_Session_0.md` + build tracker Session 1 notes
- [ ] new env vars documented (none)
- [x] tracker Session 1 marked done
- [x] footgun NEW-D in playbook + tracker
