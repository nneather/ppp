# 150 — Classwork Session 0 (Phase 0 structure lock)

**Date:** 2026-07-24
**Module:** classwork
**Tracker session:** Session 0

## Built

- Phase 0 structure lock for the classwork module — all gates answered by owner via structured questions; nothing invented by the agent.
- Tracker: [POS_Classwork_Build_Tracker.md](../POS_Classwork_Build_Tracker.md) (schema sketch, nullable matrix, MCP contracts, session arc).
- No code, no migration — `npm run check` N/A this session (docs only).

## Decided

- **New entity set** (`courses` + `assignments`) — the hard constraint from [138](138-fall-semester-priorities.md) holds: MYN `project_tasks` stays due-date-free; classwork is where deadlines live.
- **Two tables only.** Term = nullable TEXT label on `courses` (rejected: `terms` table with dates; structured season/year columns). Owner note: schema must flex to **non-academic courses of study** later (ordination prep, reading programs) — so `code` / `instructor` / `term` all nullable, nothing assumes a semester.
- **Iterative deadlines via nullable self-ref `assignments.parent_id` from day one** (rejected: separate `paper_drafts` table; flat unlinked rows). Not just papers — other assignments have iterative due dates too.
- **One status axis:** `not_started` / `in_progress` / `done` + app-stamped `completed_at` (invoices `status` + `sent_at`/`paid_at` precedent). **No grade tracking** — owner keeps focus on what he controls (rejected: `graded` state, grade field).
- **`due_date DATE NOT NULL`** (Chicago civil) — undated work belongs in MYN, not here (rejected: nullable + needs-date flag; TIMESTAMPTZ; optional due_time — deferred, open Q A2).
- **No recurrence engine** — weekly readings entered manually at syllabus time; bulk-add UI is a possible later polish, not schema (rejected: `project_task_series` clone).
- **Hybrid projects link:** nullable `courses.project_id` → Education subtree node. Owner rationale: an MCP weekly review can join course health ("Psalms and Wisdom Literature is at watch") to upcoming/behind assignments (rejected: fully parallel with no FK; courses-as-project-rows).
- **Surfaces:** `/classwork` list with **grouping toggle** `?group=date|course` (two distinct planning modes owner switches between) + Sheet forms (both entities ≪15 fields) + dashboard "due in 14 days" strip on desktop and mobile glance.
- **RLS:** projects precedent — SELECT via `app_has_module_read('classwork')`, writes owner-only. **Solo waiver:** viewer write untested/unsupported v1.
- **MCP day one:** `list_due_soon` (real implementation replaces the [144](144-ppp-mcp-readonly-v1.md) stub, **same tool name**, `horizon_days` default 14, overdue included) + `get_assignments_for_course` (fuzzy course resolve, `bible-book.ts` resolver pattern). `list_courses` rejected. Implementation deferred to Session 2 / separate prompt.

## Schema changes

- None in Session 0 (Session 1 ships `ppp_classwork_v1` per the tracker sketch).

## New components / patterns added

- [docs/POS_Classwork_Build_Tracker.md](../POS_Classwork_Build_Tracker.md) — tracker with signed Phase 0 lock.

## Open questions surfaced

- ≤2 per entity, on tracker: C1 syllabus/link storage (resolve when first syllabus lands), C2 Education-subtree picker constraint (Session 1), A1 milestone ordering under parent (Session 1), A2 time-of-day deadlines (only if hit).

## Surprises (read these before the next session)

- `user_permissions.module` is free TEXT — add `classwork` to the permissions UI slug list only (same as [090](090-sermons-session-0.md) for sermons).
- Mobile tab bar hit seven items with Sermons; Classwork would make eight — Session 1 must decide tab-bar slot vs dashboard-glance-only on mobile.
- `npm run check` N/A — docs-only session, no code touched.

## Carry-forward updates

- [x] Tracker filed with signed Phase 0 checkboxes
- [x] PLAN.md refreshed (module row, Next up, Session 1 prompt)
- [x] MODULE_KICKOFF_PLAYBOOK.md active-module pointer updated
- [ ] components.mdc — n/a (no components yet)
- [ ] AGENTS.md inventory — n/a until Session 1 code
- [x] new env vars — none
