# Classwork research papers: Brainstorm / Discovery Notes
Date: 2026-07-31 · Goal: Lock Phase 0 shape for paper tracking + paper-scoped bibliography (research papers only), ahead of fall semester

## Prior art (read before grilling)

- Classwork Sessions 0–2 shipped: `courses` + `assignments`; `kind='paper'` + `parent_id` milestones already exist ([150](../docs/decisions/150-classwork-session-0.md)). No bibliography / research surface.
- Writing workflow review ([065](../docs/decisions/065-writing-workflow-review.md)): paper-scoped citation session (short-form registry + books+essays compiled bib) deferred as **one** future feature; short-form copy + page input shipped on book detail instead.
- Fall priorities ([138](../docs/decisions/138-fall-semester-priorities.md)): explicitly deferred "paper-scoped citation registry" through Aug 31.
- Sermons pattern: standalone module, draft-friendly Sheet, dual passage model, library deep-link (no FK into scripture_references).
- Library already has `books.owned` (not-owned stubs) + essay-level citations + `/library/bibliography`.

## Summary / key decisions
- **Entity shape: (b)** — separate `papers` entity (sermons-like), optionally linked 1:1 to a classwork `assignments` row for due dates / milestones. Research surface (bib, groups, notes) lives on `papers`; short reflections stay deadline-only assignments with no paper row.
- **Assignment link: optional** — orphans allowed (independent study / personal research / pre-syllabus).
- **Course: optional `papers.course_id`** — orphans can sit under a course; when assignment-linked, assignment’s course is source of truth (keep in sync / derive in UI).
- **Paper fields v1: sermon-parallel** — title + optional course/assignment links + notes + status (`draft`/`in_progress`/`submitted`) + optional target/due date + topic/thesis + optional primary passage display string. No grade/word-count/file in v1.
- **Bibliography membership: books + essays** — paper cites attach library `books` and/or `essays`. Free-text externals deferred.
- **Not-owned: build now via (a)** — attach catalog books including `owned=false`; paper UI can create a not-owned stub then link. No paper-local freeform citation table.
- **Research groups: (b)** — named groups under a paper; each source optionally in one group; ungrouped bucket OK. Not full Zettelkasten notes graph.
- **Compiled bib export v1: flat Turabian alpha via clipboard** — research groups ignored on export; HTML + plain (books + essays merged). No paper-scoped `.docx` in v1. **Later (distinct from research groups):** optional export sections by *resource type* (commentary / essays / abbreviations section).
- **Per-source cite UX: (a)** — Footnote + Short form + Bibliography + page input on each paper source row; Parker chooses first vs subsequent. No soft registry, no auto-Ibid.
- **Routes: under classwork** — `/classwork/papers` list + `/classwork/papers/[id]` detail; permissions stay `classwork`. No top-level `/papers` module.
- **Timing: (a) accelerated** — Session 0 now; build Sessions 1–2 in early–mid August (post-Madison / St. Louis return). Driver: editing an old paper for potential publication — needs the surface sooner than Aug 31 semester start. Overrides [138] deferral of paper-scoped citation registry through Aug 31.
- **Source uniqueness: (a)** — at most one row per `(paper, book)` and per `(paper, essay)`; book + essay-from-that-book both allowed. No duplicate rows for groups (move between groups).
- **Per-source notes: (a)** — nullable `notes` on the paper↔source junction (paper-specific; not catalog `personal_notes`).
- **Create/link UX: (b)** — dual entry from `/classwork/papers` and from assignment “Open research paper” (create-or-open 1:1). Partial unique on `assignment_id`. No auto-create on kind=paper.
- **MCP: none in v1** — UI + clipboard only; no `list_papers` / due-soon join yet.
- **Session arc locked** — S1 = publication-ready (CRUD + books/essays/not-owned + cite + clipboard); S2 = research groups UI. Full schema incl. groups tables in S1 migration.

## Q&A log
### Q1 — Entity relationship
- Asked: Enrich assignment (a) vs separate `papers` 1:1-linked (b) vs fully standalone (c)?
- Captured: **(b)** — separate `papers` entity, optionally linked 1:1 to an assignment.
- Flags: none

### Q2 — Assignment linkage
- Asked: Always require assignment_id (a) vs optional orphans (b) vs schema-optional / UI-linked-only v1 (c)?
- Captured: **(b)** — optional link; orphan papers allowed.
- Flags: none

### Q3 — Course association
- Asked: Course only via assignment (a) vs optional papers.course_id (b) vs always require course_id (c)?
- Captured: **(b)** — optional `papers.course_id`; linked papers inherit/sync from assignment’s course.
- Flags: none

### Q4 — Paper identity fields
- Asked: Minimal (a) vs sermon-parallel (b) vs heavy (c)?
- Captured: **(b)** — title, status, notes, optional links, optional due/target date, topic/thesis, optional primary passage display. No grades/word-count/files v1.
- Flags: none

### Q5 — Bibliography membership (+ not-owned)
- Asked: Books only (a) vs books+essays (b) vs + free-text externals (c)?
- Captured: **(b)** books + essays. Also: **include not-owned** in this phase (do not defer).
- Flags: none (resolved in Q6)

### Q6 — Not-owned attach mechanism
- Asked: Reuse library stubs (a) vs paper-local freeform (b) vs hybrid (c)?
- Captured: **(a)** — reuse `books` including `owned=false`; create stub from paper UI then link. One catalog / one Turabian path.
- Flags: none

### Q7 — Research subgroups
- Asked: Flat bib (a) vs named groups (b) vs full Zettel notes graph (c)?
- Captured: **(b)** — named groups under a paper; source optionally in one group; ungrouped OK. Not full Zettelkasten.
- Flags: none

### Q8 — Groups vs compiled bibliography
- Asked: Flat export (a) vs grouped-by-research-group (b) vs both (c)?
- Captured: **Start with (a)** — flat Turabian-sorted compiled bib; research groups ignored on export.
- Captured (future, distinct concept): consider export sections by **resource type** (commentary, essays, abbreviations section) — not the Zettel research groups.
- Flags: resource-type bib sections → someday (do not schema for it in v1 unless cheap)

### Q9 — Citation copy UX on the paper
- Asked: Full copy affordances (a) vs soft first-cite registry (b) vs bib-only / use book detail (c)?
- Captured: **(a)** — Footnote + Short form + Bibliography + page input per source row; manual first vs subsequent. No registry, no auto-Ibid.
- Flags: none

### Q10 — Routes / nav home
- Asked: Under classwork (a) vs standalone /papers (b) vs detail-only from assignment (c)?
- Captured: **(a)** — `/classwork/papers` + `/classwork/papers/[id]`; classwork permissions.
- Flags: none

### Q11 — Timing vs semester start
- Asked: Session 0 now + build early–mid Aug (a) vs after shelf QA/semester (b) vs thin slice ASAP (c)?
- Captured: **(a)** — Session 0 now; build early–mid August. **Driver:** edit old paper for potential publication on return to St. Louis — want it sooner than 8/31. Overrides [138] deferral.
- Flags: none

### Q12 — Source uniqueness
- Asked: Unique book/essay rows; book+essay both OK (a) vs auto-suppress parent when essay added (b) vs allow duplicates across groups (c)?
- Captured: **(a)** — unique `(paper, book)` / `(paper, essay)`; book + essay from same volume both allowed; move between groups, don’t clone.
- Flags: none

### Q13 — Per-source notes
- Asked: Notes on junction (a) vs paper-level only (b) vs group-level only (c)?
- Captured: **(a)** — nullable `notes` on paper↔source junction.
- Flags: none

### Q14 — Create / link from assignment
- Asked: Papers list only (a) vs dual entry + Open research paper (b) vs auto-create on kind=paper (c)?
- Captured: **(b)** — dual entry; assignment “Open research paper” create-or-open; partial unique on assignment_id.
- Flags: none

### Q15 — MCP in v1
- Asked: None (a) vs list/get tools (b) vs due-soon hint join (c)?
- Captured: **(a)** — no MCP for papers in v1.
- Flags: none

### Q16 — Compiled bibliography transport
- Asked: Clipboard only (a) vs clipboard + .docx (b) vs .docx only (c)?
- Captured: **(a)** — clipboard HTML + plain; books+essays merged & sorted. No paper-scoped .docx in v1.
- Flags: none

### Completeness backstop
- Asked: anything missing? Recommended session arc + conventions (RLS, XOR junction, picker, no structured passages).
- Captured: **Done** — lock Session 0. Conventions accepted. Session arc adjusted for publication driver: **essays in Session 1** (not slipped); research-groups **UI** in Session 2 (schema still ships groups tables in Session 1 migration).
- Flags: none new

## Session arc (locked)
| Session | Goal |
|---|---|
| **0** (this) | Phase 0 lock + tracker + decision [188](../docs/decisions/188-classwork-research-papers-session-0.md) |
| **1** | Migration (papers + groups + sources) + `/classwork/papers` CRUD + assignment “Open research paper” + attach books (owned + not-owned stub) + attach essays + per-row cite (footnote/short/bib + page) + per-source notes + flat clipboard compiled bib (books+essays). Groups table present; UI optional/minimal. |
| **2** | Research groups UI (create/rename/reorder; assign sources; ungrouped bucket) + polish |

## Open flags (pending input)
- Resource-type bibliography sections (commentary / essays / abbreviations) → someday, post-v1
