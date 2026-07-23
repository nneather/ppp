# MYN Tasks — Design Reference (ppp Projects module)

**Methodology:** [Master Your Now (MYN)](https://myn-1mtd.com/) / *Total Workday Control* (Michael Linenberger). Simpler entry system: **1MTD** (three urgency zones, no start dates). **MYN** adds start-date-driven deferral and **FRESH** prioritization (newest start dates float to top within a zone, like an inbox).

This document is the architectural reference for the current build and for the **future global task system**.

---

## Urgency zones (implemented)

| MYN zone | DB `priority` | Outlook analogue | Review cadence |
|---|---|---|---|
| Critical Now | `critical_now` | High | ~hourly |
| Opportunity Now | `opportunity_now` | Normal | daily |
| Over the Horizon | `over_horizon` | Low | weekly |

**Soft cap (locked for fall polish — [126](decisions/126-myn-fall-backlog-lock.md)):** **50 total** open, non-deferred tasks across all zones (not per-zone). When over 50, default list shows the highest-priority / newest (FRESH) 50 and hides the rest (lowest priority first, then oldest `start_date`). Always surface an at-cap banner whenever open non-deferred count ≥ 50 (e.g. “Showing 50 of N — at cap”). Optional “Show all” toggle to reveal truncated rows. Linenberger’s classic 5 / 20 zone caps remain methodology context only — not the product soft-cap.

---

## Start date semantics (implemented)

1. **Hide if future:** open tasks with `start_date > today` (Chicago civil) are hidden unless **Show deferred** is on.
2. **FRESH sort:** visible open tasks sort `start_date DESC`, then `sort_order`, then `id`.
3. **Promote:** set `start_date = today` (jumps toward top of zone).
4. **Defer:** set future `start_date` + chosen zone (dialog); task leaves active lists until that date.
5. **Complete:** `completed_at` set; hidden unless **Show completed**.

No separate `due_date` column — deadlines are not part of v1 MYN.

---

## Current app surfaces

| Surface | Path | Purpose |
|---|---|---|
| MYN task list | `/projects/tasks` | All projects; optional `?project=<uuid>` |
| Project tree | `/projects` | Weekly health check-in (unchanged) |
| Links | Metadata Sheet (edit project) | `project_links` CRUD |
| Audit | `/settings/audit-log?module=projects` | includes `project_tasks` |

**Chicago today:** `ymdInChicago()` from `src/lib/invoicing/chicago-date.ts`.

---

## Schema (`project_tasks`)

See migration `20260604030000_ppp_project_tasks_myn.sql`. Every task **requires** `project_id` (v1).

### Recurrence ([109](decisions/109-tasks-active-badge-recurrence.md))

- Template table `project_task_series` (weekly/monthly rule + ends + `stopped_at`).
- Instances link via `project_tasks.series_id` / `series_occurrence`.
- **Complete** (or delete-this-occurrence) spawns the next open instance from the series template; no pre-generated window.
- Edit/delete prompts: **This task** vs **Entire series**.

---

## Code map

| Concern | Location |
|---|---|
| Types / zone caps | `src/lib/types/projects.ts` |
| Recurrence math | `src/lib/projects/task-recurrence.ts` |
| Load + group | `src/lib/projects/server/task-loaders.ts` |
| Actions | `src/lib/projects/server/task-actions.ts` |
| UI list | `src/lib/components/project-task-list.svelte` |
| UI sheet | `src/lib/components/project-task-sheet.svelte` |
| Route | `src/routes/tasks/` (legacy `/projects/tasks` redirects) |

---

## Fall polish backlog (locked — [126](decisions/126-myn-fall-backlog-lock.md))

`/tasks` already is the unified list. Build these; do **not** invent `/now` or nullable `project_id`.

### Ship

1. **Default project + saved views** — keep required `project_id`. Profile (or settings) **default project** for New Task when no filter is active. **Saved views** as named include/exclude (or only-project) presets over the existing loader — e.g. “All except Email Inbox”, “Education only”. Project labels stay on.
2. **Defer → next Monday** — one-click (defer dialog + optional row action): set `priority = over_horizon`, `start_date = next Chicago Monday`. Defer dialog presets: tomorrow / next Monday / +1 week / pick date.
3. **Target Now** — when `priority = opportunity_now` and `start_date = today`, style the row (badge / underline).
4. **Global soft-cap (50)** — see Urgency zones above; replace per-zone “over cap” UX with the 50-total model.

### Dropped / parked

| Item | Status |
|---|---|
| Nullable `project_id` / orphan tasks | **Dropped** |
| OTH review-queue UI (Linenberger ~75) | **Dropped** |
| Weekly guided OTH review mode | **Dropped** |
| Cross-module `source_type` + module RLS | **Parked** until a create-from-entity (book/invoice → task) need is real |
| Email / capture beyond inbound → Email Inbox | Already live ([077](decisions/077-email-to-task-and-domain-colors.md)); no further capture in this polish |

---

## Related decisions

- [045 — Session 1 tree + check-in](decisions/045-projects-session-1-tree-checkin.md)
- [046 — Session 2 dashboard + filters](decisions/046-projects-session-2-dashboard-filters.md)
- [047 — Session 3 MYN tasks + links + audit](decisions/047-projects-session-3-myn-tasks-links-audit.md)
- [099 — MYN trial adopted](decisions/099-myn-trial-adopted.md)
- [126 — Fall MYN backlog lock](decisions/126-myn-fall-backlog-lock.md)
