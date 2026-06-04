# MYN Tasks — Design Reference (ppp Projects module)

**Methodology:** [Master Your Now (MYN)](https://myn-1mtd.com/) / *Total Workday Control* (Michael Linenberger). Simpler entry system: **1MTD** (three urgency zones, no start dates). **MYN** adds start-date-driven deferral and **FRESH** prioritization (newest start dates float to top within a zone, like an inbox).

This document is the architectural reference for the current build and for the **future global task system**.

---

## Urgency zones (implemented)

| MYN zone | DB `priority` | Outlook analogue | Soft cap | Review cadence |
|---|---|---|---|---|
| Critical Now | `critical_now` | High | 5 | ~hourly |
| Opportunity Now | `opportunity_now` | Normal | 20 | daily |
| Over the Horizon | `over_horizon` | Low | none | weekly |

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

---

## Code map

| Concern | Location |
|---|---|
| Types / zone caps | `src/lib/types/projects.ts` |
| Load + group | `src/lib/projects/server/task-loaders.ts` |
| Actions | `src/lib/projects/server/task-actions.ts` |
| UI list | `src/lib/components/project-task-list.svelte` |
| UI sheet | `src/lib/components/project-task-sheet.svelte` |
| Route | `src/routes/projects/tasks/` |

---

## Future architectural build (backlog)

Use this section when starting a **cross-module task management** session.

### 1. Global Now view

- Route e.g. `/now` or top-level **Tasks** nav item.
- Reuse `project-task-list.svelte` with `showProjectLabel={true}` always.
- Optional tasks **without** `project_id` (nullable FK + migration).
- Optional filters: module tag, context (@home), energy level.

### 2. Email / capture integration

- Outlook MYN: convert mail → task in zone. ppp analogue: forward-to-capture, Slack, or manual quick-add — **no email integration in v1**.

### 3. Defer-to-Review automation

- Over-the-Horizon tasks: one-click "Defer to next Monday review" (batch set `priority = over_horizon`, `start_date = next Monday`).
- Separate review queue UI when OTH > ~75 items (Linenberger threshold).

### 4. Target Now visual

- When `priority = opportunity_now` and `start_date = today`, style row as **Target Now** (underlined / badge) — task deferred to do today.

### 5. Weekly OTH review mode

- Guided sweep: show only OTH tasks due for review this week; promote / defer / delete / complete.

### 6. Cross-module tasks

- `module` enum or `source_type` on tasks (`projects` | `library` | `invoicing` | `personal`).
- RLS per module; unified Now list for owner.

---

## Related decisions

- [045 — Session 1 tree + check-in](decisions/045-projects-session-1-tree-checkin.md)
- [046 — Session 2 dashboard + filters](decisions/046-projects-session-2-dashboard-filters.md)
- [047 — Session 3 MYN tasks + links + audit](decisions/047-projects-session-3-myn-tasks-links-audit.md)
