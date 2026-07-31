# 188 — Classwork research papers Session 0 (Phase 0 structure lock)

**Date:** 2026-07-31
**Module:** classwork (papers / paper-scoped bibliography)
**Tracker session:** Papers Session 0

## Built

- Phase 0 structure lock for **research papers** under classwork — grilled via [brainstorms/2026-07-31-classwork-research-papers.md](../../brainstorms/2026-07-31-classwork-research-papers.md); all gates answered by owner.
- Tracker extended: [POS_Classwork_Build_Tracker.md](../POS_Classwork_Build_Tracker.md) › Research papers Phase 0.
- No code, no migration — `npm run check` N/A this session (docs only).

## Decided

- **Separate `papers` entity** (sermons-like), not an enrichment column dump on `assignments`. Short reflections stay deadline-only assignments with no paper row. Creating a paper = opting into the research surface (“research papers only”).
- **Optional `assignment_id`** (partial unique when set) — orphans allowed (independent study / publication revision / pre-syllabus). Dual entry: `/classwork/papers` **and** assignment “Open research paper” create-or-open. No auto-create on `kind=paper`.
- **Optional `papers.course_id`** — orphans can sit under a course; when assignment-linked, assignment’s course is source of truth (sync / derive in UI).
- **Paper fields v1 (sermon-parallel):** title, status (`draft` / `in_progress` / `submitted`), notes, optional course/assignment links, optional due/target date, topic/thesis, optional `passage_display`. No grade / word-count / file link.
- **Bibliography:** attach library **books and essays**. Junction XOR `book_id` / `essay_id` (library polymorphic pattern). Unique per `(paper, book)` and `(paper, essay)`; book + essay-from-same-volume both allowed.
- **Not-owned: build now** — reuse catalog `books.owned=false`; paper UI can create a not-owned stub then link. No paper-local freeform citation table.
- **Research groups:** named groups under a paper; each source optionally in one group; ungrouped OK. Not a full Zettelkasten notes graph. Per-source nullable `notes` on the junction.
- **Compiled bib v1:** flat Turabian-sorted **clipboard** (HTML + plain), books + essays merged; research groups ignored on export. No paper-scoped `.docx` in v1. **Later (distinct):** export sections by resource type (commentary / essays / abbreviations) — not research groups.
- **Cite UX:** Footnote + Short form + Bibliography + page input per source row; Parker chooses first vs subsequent. **Never auto-Ibid.** No soft first-cite registry in v1 ([065](065-writing-workflow-review.md)).
- **Routes:** `/classwork/papers` + `/classwork/papers/[id]`; permissions slug stays `classwork`. No top-level `/papers` module / sidebar item.
- **MCP:** none for papers in v1.
- **Timing:** Session 0 now; Session 1–2 early–mid August (post-Madison / St. Louis). Driver: revise an old paper for potential publication — sooner than Aug 31. **Overrides** [138](138-fall-semester-priorities.md) deferral of paper-scoped citation registry through Aug 31.
- **Session arc:** Session 1 = usable publication surface (CRUD + books + essays + not-owned + cite + clipboard compile); Session 2 = research groups UI + polish. Full schema (incl. groups tables) ships in Session 1 migration.

## Schema changes

- None in Session 0 (Session 1 ships `ppp_classwork_papers_v1` per tracker sketch).

## New components / patterns added

- None in code. Tracker schema sketch + brainstorm capture.

## Open questions surfaced

- ≤2 per entity on tracker (P1 sync rule when linking assignment; G1 group soft-delete behavior).

## Surprises (read these before the next session)

- Prior art already deferred this as one feature ([065](065-writing-workflow-review.md) Q7; [138](138-fall-semester-priorities.md)) — this Session 0 **un-defers** it for the publication timeline.
- Classwork already has `assignments.kind='paper'` + `parent_id` milestones — papers do **not** replace those; they add the bib/research surface.
- `validateXor` / polymorphic helpers in library are the right insert pattern for `paper_sources` (book XOR essay).

## Carry-forward updates

- [x] Tracker Phase 0 papers section filed
- [x] PLAN.md refreshed (module row, Next up, Session 1 prompt)
- [x] MODULE_KICKOFF_PLAYBOOK.md active-module pointer updated
- [ ] components.mdc — n/a until Session 1
- [ ] AGENTS.md inventory — n/a until Session 1 code
- [x] new env vars — none
