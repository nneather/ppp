# Personal Operations System — Classwork Module Build Tracker

_Last updated: 2026-08-01 | Module: Classwork (5th) | Sessions 0–2 complete; **Papers Sessions 0–1 complete** ([188](decisions/188-classwork-research-papers-session-0.md), [189](decisions/189-classwork-papers-session-1.md)); Canvas import deferred ([173](decisions/173-canvas-classwork-import-deferred.md))_

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

## MCP read surface (fields locked; implementation in Session 2)

| Tool | Contract |
|---|---|
| `list_due_soon` | Replaces stub in `scripts/ppp-mcp/` — **same name**. Param `horizon_days` (default 14). Returns open (`status != 'done'`) assignments: title, kind, status, due_date, days_until (negative = overdue), course name + code, **`linked_task_ids`** (MYN tasks with `assignment_id` — [184](decisions/184-mcp-monday-protocol-finetune.md)). Overdue included. ✅ Session 2 / finetune 184 |
| `get_assignments_for_course` | Resolve course by name/code (fuzzy, like `src/lib/mcp/bible-book.ts` resolver). Returns full assignment list: status, due_date, kind, parent grouping. ✅ Session 2 |
| (join path) | `courses.project_id` lets a weekly review join `list_project_health` → upcoming/behind assignments for a course at `watch`/`serious`. No new tool needed — just keep `project_id` in the course payload. |

---

## Open questions

| # | Entity | Q | Resolve by |
|---|---|---|---|
| C1 | course | Syllabus/link storage — `notes` v1, or a `course_links` table (project_links pattern) later? | When first syllabus lands (~late Aug) |
| C2 | course | `project_id` picker: hard-constrain to Education subtree or suggest-only? | ✅ Session 1 — suggest-only ([153](decisions/153-classwork-session-1.md)) |
| A1 | assignment | Milestone ordering under a parent — is `due_date` sufficient or does the UI need `sort_order`? | ✅ Session 1 — `due_date` only; `sort_order` schema-only ([153](decisions/153-classwork-session-1.md)) |
| A2 | assignment | Time-of-day deadlines (11:59 PM vs in-class) — deferred; revisit only if a real same-day-ordering need appears. | Only if hit |
| D1 | dashboard | Desktop home: classwork due-soon as a **badge/strip under Now tasks** vs **integrated into the Now column** (not mixing MYN tasks with assignments as the same entity). Mobile glance placement follows. | ✅ Session 2 — **(B)** distinct Due soon card under Now + mobile Classwork tile ([161](decisions/161-classwork-session-2.md)) |

---

## Session arc

| Session | Status | Goal |
|---|---|---|
| 0 | ✅ 2026-07-24 | Phase 0 lock + this tracker + [150](decisions/150-classwork-session-0.md) |
| 1 | ✅ 2026-07-24 | Migration `ppp_classwork_v1` + gen-types + `/classwork` (group toggle) + Sheets + nav split (mobile: Dashboard/Tasks/Invoicing/Library/Classwork) + permissions/audit. C2 suggest-only; A1 due_date order. Viewer solo waiver noted. Decision [153](decisions/153-classwork-session-1.md). |
| 2 | ✅ 2026-07-24 | Dashboard due-soon (D1=B) + MCP `list_due_soon` / `get_assignments_for_course`. Decision [161](decisions/161-classwork-session-2.md). |
| — | note | Decision numbers 146–149 were taken by a parallel library publisher session on 2026-07-24 — Session 0 record is **[150](decisions/150-classwork-session-0.md)**, not 146. |
| — | backlog | Bulk/quick-add UI for syllabus entry — only if manual entry hurts in late August |
| — | backlog | **Canvas one-shot import** ([173](decisions/173-canvas-classwork-import-deferred.md)) — late August after first Fall syllabi; semester-start token mint; preview→confirm; re-pull OK for week-1–3 due-date churn. Not live sync. |
| **Papers 0** | ✅ 2026-07-31 | Research papers Phase 0 lock + schema sketch + [188](decisions/188-classwork-research-papers-session-0.md); brainstorm [2026-07-31-classwork-research-papers.md](../brainstorms/2026-07-31-classwork-research-papers.md) |
| **Papers 1** | ✅ 2026-08-01 | Migration `20260801120600_ppp_classwork_papers_v1` + `/classwork/papers` list/Sheet + `/classwork/papers/[id]` research home (search-attach books incl. free-form not-owned stub + essays, per-row Footnote/Short/Bib + page, per-source notes, merged compiled bib clipboard) + assignment Open research paper + Assignments\|Papers toggle + audit whitelist. P1 = stamp+lock. Mobile smoke 12/12; audit rows verified. Decision [189](decisions/189-classwork-papers-session-1.md). |
| **Papers 2** | ☐ | Research groups UI + polish (G1 resolve) |

**Timeline:** Core classwork Sessions 1–2 done before syllabi land; semester start **2026-08-31**. **Research papers** accelerated for post-Madison St. Louis publication edit (sooner than 8/31) — overrides [138](decisions/138-fall-semester-priorities.md) deferral. Canvas import parked for late August ([173](decisions/173-canvas-classwork-import-deferred.md)).

---

## Research papers — Phase 0 (signed off 2026-07-31)

Brainstorm: [brainstorms/2026-07-31-classwork-research-papers.md](../brainstorms/2026-07-31-classwork-research-papers.md). Decision: [188](decisions/188-classwork-research-papers-session-0.md). Prior deferred scope: [065](decisions/065-writing-workflow-review.md) Q7, [138](decisions/138-fall-semester-priorities.md).

| Gate | Resolution |
|---|---|
| **Taxonomy singular** | New tables: `papers`, `paper_research_groups`, `paper_sources`. Does **not** replace `assignments.kind='paper'` / `parent_id` milestones — those stay the deadline spine. Creating a `papers` row = opt-in research surface. |
| **Links** | Optional `papers.assignment_id` (partial unique when live) + optional `papers.course_id`. Orphans allowed. When linked, assignment’s `course_id` / `due_date` are source of truth (sync or derive — open Q P1). |
| **Nullable / required** | Papers: only `title` + `status` required. Groups: `paper_id` + `name`. Sources: `paper_id` + exactly one of `book_id` / `essay_id` (XOR). Full matrix below. |
| **Bibliography** | Books **and** essays from library catalog. Not-owned via `books.owned=false` (create stub from paper UI). No free-text external sources in v1. Unique `(paper, book)` / `(paper, essay)`. |
| **Research groups** | Named groups per paper; source optionally in one group; ungrouped bucket. Compiled bib **ignores** groups (flat Turabian alpha). Future resource-type export sections ≠ research groups. |
| **Cite / compile** | Per-row Footnote + Short form + Bibliography + page input. Compiled bib = clipboard HTML+plain (books+essays merged). No auto-Ibid; no soft registry; no paper `.docx` v1. |
| **Form delivery** | List `/classwork/papers`; detail `/classwork/papers/[id]` (bib + groups + cite — too heavy for Sheet alone). Paper identity create/edit may use Sheet from list; detail is the research home. Dual entry from assignment Sheet/row. |
| **RLS + viewer** | Same as classwork: SELECT `app_is_owner() OR app_has_module_read('classwork')`; writes owner-only. Solo waiver unchanged. No new module slug. |
| **MCP** | None for papers in v1. |
| **Edge Function ↔ `deleted_at`** | N/A — no Edge Functions. |

**Checklist:**
- [x] Taxonomy singular (papers vs assignments; groups vs future resource-type sections)
- [x] Nullable matrix signed
- [x] Routes / form surfaces decided
- [x] RLS plan (reuse classwork)
- [x] MCP deferred explicitly
- [x] Open Questions ≤2 per entity

### Schema sketch (Session 1 ships `ppp_classwork_papers_v1`)

Standard conventions: `deleted_at`, `created_at`/`updated_at` + `set_updated_at`, `created_by`, audit trigger, explicit GRANTs, RLS helpers.

#### `papers`

```sql
papers
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  title           TEXT NOT NULL
  status          TEXT NOT NULL CHECK (status IN ('draft','in_progress','submitted')) DEFAULT 'draft'
  course_id       UUID REFERENCES courses(id)       -- nullable
  assignment_id   UUID REFERENCES assignments(id)   -- nullable; partial UNIQUE where live
  due_date        DATE                              -- nullable target/due; prefer assignment when linked
  topic           TEXT                              -- thesis / topic
  passage_display TEXT                              -- human passage string; no structured passages v1
  notes           TEXT
  sort_order      INT NOT NULL DEFAULT 0
  deleted_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by      UUID REFERENCES profiles(id)
```

**Indexes:** `(course_id)`, `(assignment_id)`, `(status)` — partial `WHERE deleted_at IS NULL`.  
**Partial unique:** `(assignment_id) WHERE assignment_id IS NOT NULL AND deleted_at IS NULL`.

#### `paper_research_groups`

```sql
paper_research_groups
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
  paper_id     UUID NOT NULL REFERENCES papers(id)
  name         TEXT NOT NULL
  sort_order   INT NOT NULL DEFAULT 0
  deleted_at   TIMESTAMPTZ
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by   UUID REFERENCES profiles(id)
```

**Indexes:** `(paper_id)` — partial `WHERE deleted_at IS NULL`.

#### `paper_sources`

```sql
paper_sources
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
  paper_id     UUID NOT NULL REFERENCES papers(id)
  group_id     UUID REFERENCES paper_research_groups(id)  -- nullable = ungrouped
  book_id      UUID REFERENCES books(id)
  essay_id     UUID REFERENCES essays(id)
  notes        TEXT
  sort_order   INT NOT NULL DEFAULT 0
  deleted_at   TIMESTAMPTZ
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  created_by   UUID REFERENCES profiles(id)
  CHECK ( (book_id IS NOT NULL AND essay_id IS NULL)
       OR (book_id IS NULL AND essay_id IS NOT NULL) )
```

**Partial uniques:** `(paper_id, book_id) WHERE book_id IS NOT NULL AND deleted_at IS NULL`; `(paper_id, essay_id) WHERE essay_id IS NOT NULL AND deleted_at IS NULL`.  
**App rules:** `group_id` must belong to the same `paper_id` when set. Reuse library `validateXor`-style insert. Soft-delete paper → soft-delete children in app actions (or ON cascade soft via triggers — prefer explicit app soft-delete like other modules).

### Nullable / required matrix (papers)

| Table | Required | Nullable |
|---|---|---|
| `papers` | `title`, `status` (default), `sort_order` (default) | `course_id`, `assignment_id`, `due_date`, `topic`, `passage_display`, `notes`, `created_by` |
| `paper_research_groups` | `paper_id`, `name`, `sort_order` (default) | `created_by` |
| `paper_sources` | `paper_id`, XOR `book_id`/`essay_id`, `sort_order` (default) | `group_id`, `notes`, `created_by` |

### RLS / audit

- Same policies as `courses` / `assignments` (module `classwork`).
- Audit-log UI: extend `_CLASSWORK_TABLES` with `papers`, `paper_research_groups`, `paper_sources`; soft-delete revert for all three.
- No new `module_registry` slug.

### Open questions (papers)

| # | Entity | Q | Resolve by |
|---|---|---|---|
| P1 | paper | When linking/unlinking an assignment: auto-overwrite `course_id`/`due_date` from assignment, or show once and leave editable? | ✅ Session 1 — **stamp + lock while linked**: server re-stamps from assignment on every save; UI read-only while linked; unlink keeps last-synced values editable ([189](decisions/189-classwork-papers-session-1.md)) |
| G1 | group | Soft-deleting a group: null out `paper_sources.group_id` (sources survive ungrouped) vs block delete while sources attached? | Papers Session 2 (recommend: null out) |

### Papers session acceptance (high level)

**Session 1** (✅ 2026-08-01 — [189](decisions/189-classwork-papers-session-1.md))
- [x] Migration applied + `npm run supabase:gen-types`
- [x] `/classwork/papers` list + Sheet create/edit; `/classwork/papers/[id]` detail
- [x] Assignment “Open research paper” create-or-open (1:1)
- [x] Add/remove book sources (incl. create not-owned stub); add/remove essay sources
- [x] Per-row Footnote / Short form / Bibliography + page input; per-source notes
- [x] Copy compiled bibliography (clipboard; flat; books + essays)
- [x] Audit whitelist + `npm run check` + tests for pure helpers
- [x] Mobile-width smoke on paper detail (12/12 via browser agent; audit rows verified)

**Session 2**
- [ ] Create/rename/reorder research groups; assign/move sources; ungrouped bucket
- [ ] G1 resolved; owner smoke on a multi-group paper
