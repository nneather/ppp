# 161 — Classwork Session 2 (dashboard due-soon + MCP tools)

**Date:** 2026-07-24
**Module:** classwork
**Tracker session:** Session 2

## Built

- **D1 locked (B):** desktop `/dashboard` sticky right column gets a distinct **Due soon** Classwork card under Now (not MYN task rows). Mobile glance: Classwork tile (count + overdue hint) next to the Tasks tile (`md:hidden`).
- `loadDueSoonAssignments` / `selectDueSoon` — open (`status != done`), `due_date <= today + horizon` (default 14), overdue included, ordered by date asc.
- MCP: `list_due_soon` real (`horizon_days` default 14); new `get_assignments_for_course` with fuzzy name/code resolve via `src/lib/mcp/course.ts`.
- `<DashboardDueSoon>` + dashboard `depends('app:classwork:list')` so `/classwork` mutations refresh the home strip.
- `npm run mcp:smoke` green (10 tools).

## Decided

- **D1 = B** — integrated Now-column Classwork section (separate card under Now), not a badge-only strip under the Now card. Keeps MYN and dated assignments visually distinct while sharing the “what needs attention” column.
- Mobile follows Tasks precedent: count glance tile, full list on `/classwork`.
- Course resolve mirrors bible-book pattern (exact → unique prefix → unique substring); ambiguous → null + suggestions.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/dashboard-due-soon.svelte`](../../src/lib/components/dashboard-due-soon.svelte) — desktop due-soon panel.
- [`src/lib/mcp/course.ts`](../../src/lib/mcp/course.ts) — course name/code resolver for MCP.

## Open questions surfaced

- C1 syllabus/link storage — still deferred until first syllabus (~late Aug).
- A2 time-of-day deadlines — still deferred.
- Weekly R2 backup dump still does not include `courses` / `assignments` (ops follow-up from [153](153-classwork-session-1.md)).

## Surprises (read these before the next session)

- Hosted already had at least one live assignment in the 14d window during smoke — useful for verifying overdue/soon ordering with real data.
- Dashboard load round-trips increase by one (due-soon) on top of the documented [132](132-desktop-home-dashboard.md) exception to the ≤4 budget.
- Parallel sessions claimed **159** (PLAN trim) and **160** (TDNT/HALAT) while this session drafted — classwork Session 2 is **161**, not 159.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] tracker Session 2 done; D1 resolved
- [x] PLAN.md refreshed
- [ ] new env vars — none
