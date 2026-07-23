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

**Soft cap (shipped — [128](decisions/128-myn-fall-polish.md); locked [126](decisions/126-myn-fall-backlog-lock.md)):** **50 total** open, non-deferred tasks across all zones (not per-zone). When over 50, default list shows the highest-priority / newest (FRESH) 50 and hides the rest (lowest priority first, then oldest `start_date`). Always surface an at-cap banner whenever open non-deferred count ≥ 50 (e.g. “Showing 50 of N — at cap”). Optional “Show all” via `?all=1`. Linenberger’s classic 5 / 20 zone caps remain methodology context only — not the product soft-cap.

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
| MYN task list | `/tasks` | All projects; optional `?project=` / `?view=` / `?all=1` |
| Desktop Now pane | `/dashboard` (`md+`) | Critical + Opportunity only; full list stays on `/tasks` ([132](decisions/132-desktop-home-dashboard.md)) |
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
| Types / soft-cap | `src/lib/types/projects.ts` (`TASK_SOFT_CAP_TOTAL`) |
| Saved views + truncate | `src/lib/projects/task-views.ts` |
| Recurrence math | `src/lib/projects/task-recurrence.ts` |
| Load + group | `src/lib/projects/server/task-loaders.ts` |
| Actions | `src/lib/projects/server/task-actions.ts` |
| Profile prefs | `src/lib/projects/server/task-prefs-actions.ts` |
| UI list | `src/lib/components/project-task-list.svelte` |
| UI sheet | `src/lib/components/project-task-sheet.svelte` |
| Route | `src/routes/tasks/` (legacy `/projects/tasks` redirects) |
| Settings | `src/routes/settings/projects/` |

---

## Fall polish backlog (shipped — [128](decisions/128-myn-fall-polish.md); locked in [126](decisions/126-myn-fall-backlog-lock.md))

`/tasks` is the unified list. No `/now` route; `project_id` remains required.

### Shipped

1. **Default project + saved views** — `profiles.default_task_project_id`; named views on `profiles.task_saved_views` managed at `/settings/projects`; apply via `?view=` on `/tasks` (`?project=` wins).
2. **Defer → next Monday** — presets + “Defer to Monday (OTH)” in defer dialog.
3. **Target Now** — `opportunity_now` + `start_date = today` row badge/underline.
4. **Global soft-cap (50)** — truncate + banner; `?all=1` show all.

### Dropped / parked

| Item | Status |
|---|---|
| Nullable `project_id` / orphan tasks | **Dropped** |
| OTH review-queue UI (Linenberger ~75) | **Dropped** |
| Weekly guided OTH review mode | **Dropped** |
| Cross-module `source_type` + module RLS | **Parked** until a create-from-entity (book/invoice → task) need is real |
| Email / capture beyond inbound → Personal | Live ([077](decisions/077-email-to-task-and-domain-colors.md)); destination **Personal** after [130](decisions/130-retire-email-inbox-default-personal.md) |

---

## Related decisions

- [045 — Session 1 tree + check-in](decisions/045-projects-session-1-tree-checkin.md)
- [046 — Session 2 dashboard + filters](decisions/046-projects-session-2-dashboard-filters.md)
- [047 — Session 3 MYN tasks + links + audit](decisions/047-projects-session-3-myn-tasks-links-audit.md)
- [128 — Fall MYN polish](decisions/128-myn-fall-polish.md)
- [126 — Fall MYN backlog lock](decisions/126-myn-fall-backlog-lock.md)
- [099 — MYN trial adopted](decisions/099-myn-trial-adopted.md)
