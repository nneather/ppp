# Personal Operations System — Classwork Module Build Tracker

_Last updated: 2026-07-24 | Module: Classwork (5th) | Session 1 complete_

**Read before any session:** `docs/MODULE_KICKOFF_PLAYBOOK.md` (footgun registry + Phase 0), [000](decisions/000-invoicing-retro.md), [041](decisions/041-library-module-retro.md), [138](decisions/138-fall-semester-priorities.md), [150](decisions/150-classwork-session-0.md).

---

## Critical path

Core value — **every dated seminary deliverable in one place**: due-soon on the dashboard, group-by-course when planning a course, group-by-date when planning a week, and queryable from chat via MCP. Semester starts **2026-08-31**; syllabi land mid-to-late August.

**Hard constraint (do not revisit):** assignments carry `due_date`; MYN `project_tasks` intentionally have none ([MYN_TASKS_DESIGN.md](MYN_TASKS_DESIGN.md)). Classwork is a **new entity set** — never overload `project_tasks`.

- **End of Session 1** = schema + `/classwork` CRUD (list + Sheets + grouping toggle) — usable the day syllabi arrive.
- **End of Session 2** = dashboard due-soon strip + real MCP tools (`list_due_soon`, `get_assignments_for_course`).

---

## Phase 0 — Structure Lock (signed off 2026-07-24)

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | Two tables: `courses` + `assignments`. Term = nullable TEXT label on `courses` (no `terms` table). Paper drafts / iterative deadlines = assignment rows linked via nullable self-ref `assignments.parent_id`. Kind = closed enum on assignments. One status axis (`not_started` / `in_progress` / `done`); no grade tracking — focus stays on what Parker controls. |
| **Non-academic flexibility** | `courses` must work for future non-academic courses of study (ordination prep, reading programs): `code`, `instructor`, `term` all nullable; nothing in the schema assumes a semester. |
| **Nullable / required** | Courses: only `name` required. Assignments: `course_id`, `title`, `kind`, `status`, `due_date` required; all else nullable. Full matrix below. |
| **Relationship to projects** | Hybrid: nullable `courses.project_id → projects(id)` (Education subtree node). Rationale: MCP weekly review can join course health ("Psalms and Wisdom Literature is at watch") to upcoming/behind assignments. No FK from assignments to anything outside the module. |
| **Form delivery** | Both entities well under ~15 fields → Sheets. List at `/classwork` with a **grouping toggle** `?group=date\|course` (URL is source of truth). Dashboard "due in 14 days" strip (desktop + mobile glance). |
| **RLS + viewer** | Projects precedent: SELECT via `app_is_owner()` OR `app_has_module_read('classwork')`; INSERT/UPDATE/DELETE owner-only. **Solo waiver:** viewer write untested/unsupported v1 (no collaborator). |
| **Recurrence / import** | None. Rows entered manually at syllabus time; a bulk/quick-add UI is a Session 1+ polish option, not schema. No recurrence series table. |
| **MCP read surface (day one)** | `list_due_soon` (replaces existing stub, **same tool name** per [144](decisions/144-ppp-mcp-readonly-v1.md)) + `get_assignments_for_course`. `list_courses` rejected. Implementation is a separate session — Session 0 locks the queryable fields only (below). |
| **Edge Function ↔ `deleted_at`** | N/A — no Edge Functions planned. |

**Checklist:**
- [x] Taxonomy singular (one term encoding, one status axis, one draft mechanism)
- [x] Nullable matrix signed
- [x] Sheet vs page decided (+ grouping toggle)
- [x] RLS plan + viewer solo waiver written
- [x] MCP day-one surface locked
- [x] Open Questions ≤2 per entity

---

## Schema sketch (Session 1 ships `ppp_classwork_v1` — do not apply in Session 0)

Standard conventions apply: `deleted_at` soft delete, `created_at`/`updated_at` + `set_updated_at` trigger, `created_by`, audit trigger, explicit GRANTs (footgun #8), RLS helpers (footgun from [000](decisions/000-invoicing-retro.md)).

### `courses`

```sql
courses
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name         TEXT NOT NULL                 -- 'Psalms and Wisdom Literature'
  code         TEXT                          -- 'OT512'; nullable
  instructor   TEXT                          -- nullable
  term         TEXT                          -- free label: 'Fall 2026'; NULL fine for non-academic
  status       TEXT NOT NULL CHECK (status IN ('active','completed')) DEFAULT 'active'
  project_id   UUID REFERENCES projects(id)  -- nullable; Education subtree node (MCP health join)
  notes        TEXT
  sort_order   INT NOT NULL DEFAULT 0
  deleted_at   TIMESTAMPTZ
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by   UUID REFERENCES profiles(id)
```

**Indexes:** `(status)`, `(project_id)` — partial `WHERE deleted_at IS NULL`.
**App rules:** `project_id` picker suggests Education subtree (constraint level = open question C2). Soft-deleting a linked project must not break the course — treat a dead link gracefully.

### `assignments`

```sql
assignments
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
  course_id    UUID NOT NULL REFERENCES courses(id)
  parent_id    UUID REFERENCES assignments(id)   -- nullable; milestone grouping (proposal → draft → final)
  title        TEXT NOT NULL
  kind         TEXT NOT NULL CHECK (kind IN ('paper','exam','reading','quiz','presentation','other'))
                 DEFAULT 'other'
  status       TEXT NOT NULL CHECK (status IN ('not_started','in_progress','done'))
                 DEFAULT 'not_started'
  due_date     DATE NOT NULL                     -- Chicago civil (ymdInChicago); undated work stays in MYN
  completed_at TIMESTAMPTZ                       -- stamped by app when status → 'done' (invoices sent_at/paid_at precedent)
  notes        TEXT
  sort_order   INT NOT NULL DEFAULT 0
  deleted_at   TIMESTAMPTZ
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by   UUID REFERENCES profiles(id)
```

**Indexes:** `(course_id)`, `(due_date)`, `(parent_id)` — partial `WHERE deleted_at IS NULL`.
**App rules:** `parent_id` must reference an assignment in the **same course**; cycle guard (projects `parent_id` precedent). "Due soon" = `status != 'done' AND deleted_at IS NULL AND due_date <= today + horizon` — **overdue rows included** and surfaced first.

### Nullable / required matrix

| Table | Required | Nullable |
|---|---|---|
| `courses` | `name`, `status` (default), `sort_order` (default) | `code`, `instructor`, `term`, `project_id`, `notes`, `created_by` |
| `assignments` | `course_id`, `title`, `kind` (default), `status` (default), `due_date`, `sort_order` (default) | `parent_id`, `completed_at`, `notes`, `created_by` |

### RLS / triggers / registry

- **RLS both tables:** SELECT `app_is_owner() OR app_has_module_read('classwork')`; INSERT/UPDATE/DELETE `app_is_owner()`.
- **Triggers both tables:** `set_updated_at`, audit (`write_audit_log`). Cross-module FK ops (`courses.project_id`) follow the existing `revertible = false` convention.
- **`module_registry`:** slug `classwork`, label `Classwork`.
- **`user_permissions.module`** is free TEXT — add `classwork` to the permissions UI slug list ([090](decisions/090-sermons-session-0.md) surprise).
- **Audit-log UI:** add `_CLASSWORK_TABLES` whitelist + module `<select>` option in `/settings/audit-log` (Session 1).

---

## MCP read surface (fields locked; implementation in Session 2 or separate prompt)

| Tool | Contract |
|---|---|
| `list_due_soon` | Replaces stub in `scripts/ppp-mcp/` — **same name**. Param `horizon_days` (default 14). Returns open (`status != 'done'`) assignments: title, kind, status, due_date, days_until (negative = overdue), course name + code. Overdue included. |
| `get_assignments_for_course` | Resolve course by name/code (fuzzy, like `src/lib/mcp/bible-book.ts` resolver). Returns full assignment list: status, due_date, kind, parent grouping. |
| (join path) | `courses.project_id` lets a weekly review join `list_project_health` → upcoming/behind assignments for a course at `watch`/`serious`. No new tool needed — just keep `project_id` in the course payload. |

---

## Open questions

| # | Entity | Q | Resolve by |
|---|---|---|---|
| C1 | course | Syllabus/link storage — `notes` v1, or a `course_links` table (project_links pattern) later? | When first syllabus lands (~late Aug) |
| C2 | course | `project_id` picker: hard-constrain to Education subtree or suggest-only? | ✅ Session 1 — suggest-only ([153](decisions/153-classwork-session-1.md)) |
| A1 | assignment | Milestone ordering under a parent — is `due_date` sufficient or does the UI need `sort_order`? | ✅ Session 1 — `due_date` only; `sort_order` schema-only ([153](decisions/153-classwork-session-1.md)) |
| A2 | assignment | Time-of-day deadlines (11:59 PM vs in-class) — deferred; revisit only if a real same-day-ordering need appears. | Only if hit |
| D1 | dashboard | Desktop home: classwork due-soon as a **badge/strip under Now tasks** vs **integrated into the Now column** (not mixing MYN tasks with assignments as the same entity). Mobile glance placement follows. | Session 2 (or polish pass) — owner pick from screenshot context |

---

## Session arc

| Session | Status | Goal |
|---|---|---|
| 0 | ✅ 2026-07-24 | Phase 0 lock + this tracker + [150](decisions/150-classwork-session-0.md) |
| 1 | ✅ 2026-07-24 | Migration `ppp_classwork_v1` + gen-types + `/classwork` (group toggle) + Sheets + nav split (mobile: Dashboard/Tasks/Invoicing/Library/Classwork) + permissions/audit. C2 suggest-only; A1 due_date order. Viewer solo waiver noted. Decision [153](decisions/153-classwork-session-1.md). |
| 2 | 🔲 | Dashboard due-soon + MCP `list_due_soon` / `get_assignments_for_course`. **Lock D1 first:** badge under Now vs Now-adjacent strip (see Open Q). Mobile glance too. |
| — | note | Decision numbers 146–149 were taken by a parallel library publisher session on 2026-07-24 — Session 0 record is **[150](decisions/150-classwork-session-0.md)**, not 146. |
| — | backlog | Bulk/quick-add UI for syllabus entry — only if manual entry hurts in late August |

**Timeline:** Session 1 before syllabi land (target mid-August, after Aug 9 STL return); Session 2 before 2026-08-31.
