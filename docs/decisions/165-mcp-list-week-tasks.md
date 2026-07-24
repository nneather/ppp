# 165 — MCP `list_week_tasks` (coming-week horizon)

**Date:** 2026-07-24
**Module:** projects / MCP
**Tracker session:** ad-hoc (Monday-protocol week-ahead gap)

## Built

- MCP tool **`list_week_tasks`** — params `{ days?: 1–31 }` (default 7). Returns non-done tasks whose `start_date` is in `[todayYmd .. todayYmd+days]` (America/Chicago), **all MYN zones** (incl. Over-the-Horizon). Excludes projects with lifecycle `done` / `archived`.
- Loader [`loadWeekTasks`](../../src/lib/projects/server/task-loaders.ts) + pure helpers [`week-tasks.ts`](../../src/lib/projects/week-tasks.ts) (`clampWeekTaskDays`, `compareWeekHorizonTasks`, `summarizeWeekTasksByProject`).
- Response: `{ todayYmd, windowDays, windowEndYmd, count, by_project, tasks[] }` — flat task rows with `project_name` + `priority_label`; `by_project` for spread. Sorted `start_date` asc then zone.
- Wired in `scripts/ppp-mcp/{index,tools,smoke}.ts` + README; unit tests; smoke green.

## Decided

- **Distinct from `list_now_tasks`:** Now = Critical + Opportunity with `start_date <= today` (active). Week horizon = upcoming `start_date` window across zones — Monday-protocol “coming week’s realm,” not the hot Now pane.
- **Inclusive window** `[today .. today+days]` — a task 10 days out appears only when `days >= 10`.
- **Project filter:** drop done/archived parents (match `list_project_health` non-done set); soft-deleted tasks already excluded via `deleted_at`.
- Decision number **165** — parallel session filed [164](164-mcp-list-project-health-filters.md) for `list_project_health` filters on the same MCP surface.

## Schema changes

- None.

## New components / patterns added

- `src/lib/projects/week-tasks.ts` — client-safe window/sort/group helpers.
- `loadWeekTasks` on task-loaders (reuse from MCP; available to app later if needed).

## Open questions surfaced

- None for v1. Optional later: include overdue open tasks (`start_date < today`) as a flag for “still in flight this week” — out of contract for this tool.

## Surprises (read these before the next session)

- Hosted data during smoke had only Opportunity Now rows in the 7d window (no OTH starting this week) — zone filter is still “all zones,” not Now-only.
- Concurrent MCP edit ([164](164-mcp-list-project-health-filters.md)) touched the same `scripts/ppp-mcp/*` files; keep merges careful.

## Carry-forward updates

- [x] AGENTS.md inventory (`loadWeekTasks`, `week-tasks.ts`, mcp:smoke cite)
- [x] PLAN.md refreshed
- [x] scripts/ppp-mcp/README.md tool table
- [ ] components.mdc — n/a
- [ ] new env vars — none
