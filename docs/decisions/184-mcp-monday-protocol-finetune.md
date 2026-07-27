# 184 — MCP Monday-protocol finetune (brain consumer)

**Date:** 2026-07-27
**Module:** projects / classwork / contacts / MCP
**Tracker session:** ad-hoc (first live monday-protocol run against ppp MCP)

## Built

1. **`list_week_tasks` split** — response is no longer a flat `tasks[]`. Returns:
   - `starting_this_week` — open tasks with `start_date` in `[today .. today+days]` (all MYN zones; prior contract)
   - `carried_over` — open tasks with `start_date < today`, **Critical + Opportunity only**
   - `starting_count` / `carried_over_count` / `count` (sum) / `by_project` across both
2. **`projects.deferred_until`** — nullable date; edit on project Sheet; seeded Summer Writing → `2026-08-09`. `list_project_health` adds `deferred_until` + `is_deferred` (true when `deferred_until > today`). Dashboard check-in nudge skips deferred projects (`countMissingWeekCheckIns`).
3. **`project_tasks.assignment_id`** → `assignments(id)` ON DELETE SET NULL. MCP surfaces `assignment_id` on task tools and `linked_task_ids` on `list_due_soon`. One-time backfill: Grade Reflection on Ince ↔ Grade Ince Reflection.
4. **`list_contacts_due.contacts_with_cadence`** — count of active contacts with reminders on (eligible pool). Distinguishes empty CRM (`0`/`0`) from “none due.”

Migration: `20260727155538_mcp_monday_protocol_finetune.sql` (pushed + `gen-types`).

## Decided

- **Keep one week call, split buckets** — do **not** widen to `start_date <= today+days` (collapses MYN distinction). Consumers that trusted the old flat list under-reported carried work (7/27 pastoral-theology reply).
- **`carried_over` zone filter** — Critical + Opportunity only. OTH with old `start_date` is intentional backlog parking; including it would flood the week picture. Cap not needed once OTH is excluded.
- **`deferred_until` over a new `health_status=deferred`** — additive; preserves real health for when the park lifts. Consumers suppress from “degraded” when `is_deferred`.
- **Check-in nag** — skip while deferred (`deferred_until > today`). Health picker still available if you want to rate anyway.
- **No auto-clear** — past/equal dates are inert (`is_deferred` false). Column retains history; clear manually in the Sheet when desired.
- **Task↔assignment link** — write-time duplicates remain legitimate (task = when I’ll do it). Link is for consumer dedupe only. **UI:** MCP/data-only for now (no task-sheet picker); backfill covered the known Ince pair.
- **`contacts_with_cadence`** = eligible pool (`active` + `no_reminders=false`), not “explicit `cadence_days` set” — effective cadence always falls back to profile/app default.

## Payload shape changes (brain monday-protocol must match)

| Tool | Change |
|---|---|
| `list_week_tasks` | **Breaking:** remove flat `tasks[]`. Add `starting_this_week[]`, `carried_over[]`, `starting_count`, `carried_over_count`. Task rows gain `assignment_id`, `priority_label`. |
| `list_now_tasks` | Additive: each task includes `assignment_id` (+ `priority_label`). |
| `list_due_soon` | Additive: each assignment includes `linked_task_ids: string[]`. |
| `list_project_health` | Additive: `todayYmd`, per project `deferred_until`, `is_deferred`. |
| `list_contacts_due` | Additive: `contacts_with_cadence: number`. |

## Schema changes

- `projects.deferred_until date` (+ partial index)
- `project_tasks.assignment_id uuid` → `assignments(id)` ON DELETE SET NULL (+ partial index)
- Data: Summer Writing `deferred_until='2026-08-09'`; Ince task↔assignment link

## New components / patterns added

- `src/lib/projects/deferred.ts` — `isProjectDeferred`
- `loadOpenTaskIdsByAssignmentId` on task-loaders
- `week-tasks.ts` — `isCarriedOverPriority` / `CARRIED_OVER_PRIORITIES`
- Project form Sheet — Deferred until date field

## Open questions surfaced

- Optional later: task Sheet “link to assignment” picker once syllabus load makes linking common.
- Optional later: hide deferred projects from `/projects` attention filter (MCP already exposes `is_deferred` for consumers).

## Surprises (read these before the next session)

- First monday-protocol run returned `list_week_tasks` count 3 with the real work only in `list_now_tasks` — tool name “week” implied live-this-week, implementation was start-this-week only.
- Smoke after fix: `starting_count: 3`, `carried_over_count: 1`, `contacts_with_cadence: 0` (CRM eligible pool empty; search still finds seed contact).

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [x] scripts/ppp-mcp/README.md tool table
- [x] components.mdc — project-form-sheet note (deferred until)
- [ ] new env vars — none
- [x] trackers noted (projects / classwork MCP contracts)
