# Personal Operations System — Projects Module Build Tracker

_Last updated: 2026-06-04 | Module: Project Management (3rd) | v1 feature-complete — owner phone smoke optional_

_Session 0 is structure-lock only (no Cursor). Each feature session ships a vertical slice, ends with an Acceptance checklist + decision record, and carries an explicit viewer/RLS line and per-session test cadence._

**Read before any session:** `docs/MODULE_KICKOFF_PLAYBOOK.md` (Phase 0 + footgun registry), invoicing retro (000), library retro (041).

---

## Critical Path Note

Internship is in progress. Core value — **recording weekly project health across the tree** — ships first.

- **End of Session 1** = the editable project tree is live; you run a weekly check-in on every active node. Internship-critical capability.
- **End of Session 2** = read-only dashboard glance (grouped by domain) + trends + filters.
- **Session 3** = links / tasks / audit enrichment — slippable post-v1.

**Small module.** No import, no Edge Functions, no polymorphic primitive, no citations, **no roll-up computation** (parent status is set manually). Estimated window: **8–11 Cursor hours** across 3 sessions. Main effort sits in the Session 1 inline-edit tree; everything else is light.

---

## Design center: the weekly check-in

Parent health is **set manually**, not computed — you set the children, glance at them, then call the parent (4 satisfactory + 1 watch → likely satisfactory). That means every active node gets a manually-set weekly status, so the recording surface must let you sweep the whole tree in one pass, not N sheets.

- `/projects` is a **single inline-editable tree**: parents prominent, children nested + collapsible, each row an inline status picker for the current week. It is the list AND the editor.
- **Carry-forward:** each week pre-fills from last week; you touch only what moved.
- **Full weekly snapshot on save:** clean trends + unambiguous "checked in this week."
- **Sweep scope:** active + paused only.
- Editing a parent shows its children's statuses inline (judgment with evidence in view).
- Project metadata (name, parent, dates) stays a Sheet; weekly health is inline.

---

## How this module differs from Library (lesson inversions)

| Library lesson | Applies? | Why |
|---|---|---|
| Phase 0 structure-lock | **Yes** | Gates below. |
| Singular taxonomy (022) | **Yes — stronger** | One entity + `parent_id`. Four domains are seeded root rows, not an enum. No tags axis. |
| Nullable + `needs_review` default | **Inverted** | Hand-entered → required fields; no `needs_review`. |
| >15-field form → pages (1.5e) | **Inverted** | Small forms → Sheet for metadata; health is inline. |
| Reconcilable imports (007) | **N/A** | No import. |
| Polymorphic reuse | **N/A** | Plain child tables. |
| Edge Function ↔ `deleted_at` | **N/A** | No Edge Functions. |
| Per-session testing + viewer line | **Yes** | Enforced per session. |

---

## Phase 0 — Structure Lock (sign off before Session 1 code)

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | `projects` + self-referential `parent_id`. Four domains (Education/Work/Ministry/Personal) seeded as roots. `lifecycle_status` and `health_status` orthogonal. No enum, no tags. |
| **Parent health** | **Manually set per node** (not roll-up). Every node has its own `project_updates`. No recursive view. |
| **Nullable / required** | `projects.name` + `lifecycle_status` required (default `active`). `parent_id`/`description`/`start_date`/`end_date` nullable (`end_date` NULL = ongoing). `project_updates.week_of` + `health_status` required. No `needs_review`. |
| **Form delivery** | Metadata → Sheet (~6 fields). Weekly health → inline tree. |
| **RLS + viewer** | Owner-only v1; SELECT policy permission-gated so flipping the `user_permissions('projects')` seed to `read` grants read with no migration. Viewer write **waived** for v1. |
| **Schema audit** | ≤2 open Qs per entity (below). |
| **Edge Function ↔ `deleted_at`** | N/A. |

**Checklist:**
- [ ] One entity + `parent_id`; 4 roots seeded; orthogonality confirmed
- [ ] Parent health is manual (no roll-up view) — confirmed
- [ ] Nullable/required matrix signed
- [ ] Metadata=Sheet, health=inline tree
- [ ] Viewer waiver written; permission-gated SELECT
- [ ] Open Questions ≤2 per entity

---

## Footgun registry — front-load to the agent

| # | Rule | Relevance |
|---|------|-----------|
| 1 | **Svelte 5 `$effect` deps.** Wrap seed probes in `untrack()`. | Inline tree pre-fills + per-row state — high risk here. |
| 2 | **Always check `error` on Supabase calls.** | Every loader/action. |
| 4 | **Migrations immutable by filename.** New migration only. | `project_tasks` gets its own file in S3. |
| 6 | **Hosted-only Supabase.** `db push`; no local reset. | Migration apply. |
| 8 | **API grants on every new table.** | In `ppp_projects_v1.sql`. |
| **NEW-A** | **Partial unique index + soft delete.** `UNIQUE(project_id, week_of) WHERE deleted_at IS NULL`. | `project_updates`. |
| **NEW-B** | **Hierarchy cycle guard.** Setting `parent_id` rejects self/descendant; tree render needs a depth cap. | `projects` parent picker + tree. |
| **NEW-C** | **Bulk inline save.** A whole-tree snapshot save is many rows in one action — batch the upsert, check `error`, don't fire N round-trips. | Session 1 check-in save. |
| **NEW-D** | **Partial unique ≠ PostgREST `onConflict`.** Upsert on PK `id` after pre-loading week rows (revive soft-deleted); not on `(project_id, week_of)`. | Session 1 — [045](decisions/045-projects-session-1-tree-checkin.md). |

---

## Schema Delta — `ppp_projects_v1.sql`

_Full migration written separately (`ppp_projects_v1.sql`). Tables: `projects`, `project_updates`, `project_links`. `project_tasks` deferred to S3 (own migration, after T1 resolved). Standard conventions + GRANTs + per-table triggers._

Key points:
- `projects.parent_id UUID REFERENCES projects(id)` — NULL = root domain. Four roots seeded.
- `project_updates.week_of` = **civil Sunday** as a `DATE` (DB check `extract(dow) = 0`), partial unique per week. **Convention note:** projects weeks *start* Sunday; invoicing uses Monday–Sunday weeks *containing* a date. Different conventions on purpose — app week math computes the Chicago civil Sunday; don't let it fight invoicing mentally.
- Health recorded on any node; **no roll-up view**.
- Cycle guard + block-delete-with-children enforced app-side.

---

## Open Questions (≤2 per entity)

| Entity | # | Question | Status |
|---|---|---|---|
| projects | P1 | Parent health computed vs manual | ✓ **Manual** |
| projects | P2 | Delete a parent with children: block vs cascade | ✓ Block — reparent first |
| project_updates | U1 | Snapshot-all vs touch-only on save | ✓ Snapshot-all, carry-forward pre-fill |
| project_updates | U2 | Editable past weeks | ✓ Yes |
| dashboard | D1 | Extra lifecycle filters | ✓ Default active+paused+idea; chips for done/archived/not_started |
| cross | X1 | Viewer access v1 | ✓ Owner-only; permission-gated upgrade |

---

## Session 0 — Structure Lock & Schema (artifact-only) ✓ done

| Task | Done | Notes |
|------|:----:|-------|
| Sign off Phase 0 | ✓ | Locked in tracker Phase 0 table. |
| `ppp_projects_v1.sql` finalized | ✓ | Applied as `20260603170000_ppp_projects_v1.sql`. |
| File `docs/decisions/NNN-projects-session-0-audit.md` | ☐ | Optional; structure in tracker + [045](decisions/045-projects-session-1-tree-checkin.md). |

---

## Session 1 — Project Tree + Weekly Check-in (4–5h) [CORE VALUE] ✓ done 2026-06-03

_Goal: create projects under domains and sweep weekly health across the whole active tree in one pass._

| Task | Done | Notes |
|------|:----:|-------|
| Apply `ppp_projects_v1.sql` (staging → prod) | ✓ | Prod via `npm run supabase:db:push`; 4 roots. |
| `supabase gen types typescript` + commit | ✓ | `database.ts` regenerated. |
| `/projects` **inline-editable tree** — parents large, children nested + collapsible | ✓ | Default expanded desktop / collapsed mobile. |
| Per-row inline health picker (5-segment), pre-filled carry-forward from last week | ✓ | `untrack()` on seed `$effect` (footgun #1). |
| Week selector (defaults current Sunday) | ✓ | `?week=` + date input. |
| Expand-row for `reason` / `next_steps` | ✓ | Plain text v1 (no markdown renderer yet). |
| Save = batched snapshot upsert of active+paused nodes for the week | ✓ | PK upsert (NEW-D), one action (NEW-C). |
| Project metadata **Sheet** — name, parent picker, lifecycle, start/end dates | ✓ | Cycle guard server + client (NEW-B). |
| Soft-delete + undo; **block if live children** | ✓ | 10s undo toast. |
| RLS/viewer waiver verify | ✓ | Owner-only v1; SELECT pre-wired for `read`. |
| **Per-session tests:** `npm run check`; mobile pass; error-path; `audit_log` | ✓ | `week.test.ts` added; vite PWA patch TS error pre-existing. |
| Post-ship fixes (re-save, draft merge, PWA tab shell) | ✓ | `update_id` + `randomUUID()`; tree-only draft merge; `h-dvh` flex tab bar — [045](decisions/045-projects-session-1-tree-checkin.md) surprises. |

**Acceptance:**
- [x] 4 roots present; migration applied; types regenerated; zero TS errors on projects files.
- [ ] Owner: create project under Work + sub-project (phone smoke).
- [ ] Owner: weekly check-in sweep + batch save (phone smoke).
- [x] Parent picker can't select self/descendant (server + filtered options).
- [x] Re-run same week uses PK upsert (partial unique holds); second save in one session (no `id` null).
- [x] Delete-with-children blocked; audit log Projects filter wired.

**Decision:** [045-projects-session-1-tree-checkin.md](decisions/045-projects-session-1-tree-checkin.md)

---

## Session 2 — Dashboard Glance + Trend + Filters (2–3h) ✓ done 2026-06-03

_Goal: read-only at-a-glance view + week-over-week trend + filtering. No recursion — all flat queries._

| Task | Done | Notes |
|------|:----:|-------|
| `/dashboard` status strip — grouped by domain, parents w/ current health, expand to children | ✓ | `project-status-strip.svelte`; latest health + trend. |
| Module tile — count of nodes whose latest health ∈ {watch, serious, critical}, deep link `/projects?health=attention` | ✓ | `dashboard-projects-tile-footer.svelte`; active count on tile. |
| Trend arrows per node — compare node's last two updates | ✓ | `health-trend-badge.svelte` + `trendDirection()`. |
| `/projects` filters — lifecycle, health, domain (root) | ✓ | URL-synced; default lifecycle active+paused+idea; `not_started` added. |
| Mobile pass | ✓ | `pb-tabbar` on dashboard; filter chips wrap. |
| **Per-session tests** | ✓ | `filter.test.ts`; `npm run check` (pre-existing PWA patch TS only). |

**Acceptance:**
- [x] Strip groups by domain, expands to children, shows current health + trend.
- [x] Attention tile count + deep link correct.
- [x] `?health=attention&domain=Work` round-trips back/forward.
- [x] Nodes with no update render "—".

**Decision:** [046-projects-session-2-dashboard-filters.md](decisions/046-projects-session-2-dashboard-filters.md)

---

## Session 3 — MYN Tasks + Links + Audit + Smoke (2–3h) ✓ done 2026-06-04

_Reworked mid-session: tasks follow **MYN** (Master Your Now), not lean checklist. Design: [MYN_TASKS_DESIGN.md](MYN_TASKS_DESIGN.md)._

| Task | Done | Notes |
|------|:----:|-------|
| `project_links` inline editor (metadata Sheet, edit mode) | ✓ | `project-links-editor.svelte`; hard delete. |
| T1 → `project_tasks` migration + types | ✓ | `20260604030000_ppp_project_tasks_myn.sql`; start date, no due_date. |
| MYN task UI — `/projects/tasks` (zones, FRESH, defer/promote/complete) | ✓ | Not drag-reorder; global list + `?project=` filter. |
| Extend `/settings/audit-log` — `project_tasks` | ✓ | Soft-delete revert. |
| Full smoke (owner) on phone | ☐ | Code complete; owner to run on device. |
| Decision record + `PLAN.md` + `MYN_TASKS_DESIGN.md` | ✓ | [047](decisions/047-projects-session-3-myn-tasks-links-audit.md). |

**Backlog (future session):** global cross-module Now view — see [MYN_TASKS_DESIGN.md § Future](MYN_TASKS_DESIGN.md#future-architectural-build-backlog).

---

## Backlog (not a numbered session)

| Item | Notes |
|------|-------|
| **Status appearance polish** | Separate ad-hoc chat — health/lifecycle colors, labels, sizing per owner design doc. Touch: `health-trend-badge.svelte`, `project-tree.svelte`, strip, filter bar. Prompt in [PLAN.md § Session prompts](PLAN.md#session-prompts-copy-paste). |

---

- [x] Session 1 tracker row marked done with notes
- [x] `docs/decisions/045-projects-session-1-tree-checkin.md` filed; Surprises section written
- [x] New DB gotcha → footgun registry (NEW-D)
- [x] `PLAN.md` updated
- [x] Session 2+ rows follow same checklist at session end

## Schema reference (applied)

| Artifact | Location |
|----------|----------|
| Migration (prod) | `supabase/migrations/20260603170000_ppp_projects_v1.sql` |
| Generated types | `src/lib/types/database.ts` — `projects`, `project_updates`, `project_links`, `project_tasks` |
| Human-readable DDL | [POS_Schema_v1.md](POS_Schema_v1.md#projects) |
| App enums / view-models | `src/lib/types/projects.ts` |

---

## Notes

- **Manual parent status** (not roll-up) simplifies the module: no recursive view, all flat queries. Trade-off accepted deliberately — judgment ("4 satisfactory + 1 watch = satisfactory") beats a mechanical worst-of-subtree for this user.
- **The check-in ergonomic is the module.** A clunky per-sheet flow would kill the weekly habit; the inline tree + carry-forward is the whole point.
- Hierarchy is one self-referential table — domains are parentless projects; add a fifth anytime. Cleanest application of 022 (no enum + tree duplication).
- The earlier `research_projects` idea is absorbed: a research project is a project under Education/Ministry; its `project_links` are the dossier seed.
- Viewer owner-only by waiver; granting read later is a one-row `user_permissions` change.
