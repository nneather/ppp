# Library not-owned / research stubs: Session 0 Phase 0
Date: 2026-07-21 · Goal: Lock structure for `books.owned` (or equivalent) + hide-from-search + create-from-queue + matched Goodreads diffs — no implementation yet.
Decision: [docs/decisions/101-library-not-owned-session-0.md](../docs/decisions/101-library-not-owned-session-0.md)

Sources: PLAN.md Next up #7, [089](../docs/decisions/089-book-rating-ui-goodreads-import.md), [093](../docs/decisions/093-goodreads-triage-execution.md), [brainstorms/2026-07-17-goodreads-not-owned-queue.md](./2026-07-17-goodreads-not-owned-queue.md), MODULE_KICKOFF_PLAYBOOK.

## Summary / key decisions
- **Column:** `books.owned boolean NOT NULL DEFAULT true` (Q1 → A). Existing rows backfill to owned; unowned stubs = `false`. No second axis.
- **List/search default:** Hide unowned by default; also exclude from people/series/publisher book counts unless an explicit include-unowned filter is on (Q2 → B).
- **Bibliography + review:** Bib **includes** unowned by default (cite what you don’t own); review **excludes** unowned by default (Q3 → B). Flag: bibliography UX needs follow-up work so stubs behave correctly there (not blocking Session 1 schema/list hide).
- **Create-from-queue:** Minimal stub — `title` required; author optional; carry Goodreads ★ → `rating` and review/notes → `personal_notes`; `needs_review=false`; never invent ISBN (Q4 → A).
- **Matched diffs:** Year/publisher via `book_metadata_proposals`; ISBN diffs informational only — never proposed / never overwrite (Q5 → D). **Session 2+.**
- **RLS/viewer:** Same default hide as owner for viewers with library read (Q6 → A); viewer RLS smoke waived / known gap until collaborator (Q6 → D). Owner-only writes assumed.
- **Harvard Classics:** Full essay breakout **deferred** — PLAN backlog only; not in owned Session 1 (Q7 → C).
- **Session 1 slice:** Schema + hide defaults + create-from-queue UI (Q8 → B). Matched diffs deferred to Session 2+. No library rows from queue until Session 1 ships.
- **Create surface:** Dedicated `/settings/library/not-owned` seeded from curated queue file (Q9 → B). Not Goodreads CSV re-upload; not full BookForm.

## Phase 0 checklist
- [x] Taxonomy singular — `owned` only (no research_stub axis)
- [x] Nullable matrix — `owned NOT NULL DEFAULT true`; stub create: title required; author/rating/notes optional; ISBN never invented
- [x] Form surfaces — BookForm/detail `owned` toggle; create via settings not-owned page (compact); no Sheet for 30-field form
- [x] Viewer path — same owned-default as owner; smoke waived (known gap)
- [x] Import/bulk — curated queue create (authenticated owner); not service-role spreadsheet path
- [x] Open questions ≤2 — (1) bibliography stub UX later (2) viewer RLS smoke deferred

## Q&A log

### Q1 — Column / taxonomy
- Asked: owned bool vs research_stub vs both vs enum
- Captured: **A** — `books.owned boolean NOT NULL DEFAULT true`
- Flags: none

### Q2 — List / search default
- Asked: hide unowned default scope (list only vs + counts vs badge vs hybrid search)
- Captured: **B** — hide unowned by default on `/library` (+ keyword/essay lanes); also hide from people/series/publisher book counts unless include-unowned filter on. Direct `/library/books/[id]` still works.
- Flags: none

### Q3 — Bibliography + review
- Asked: how stubs appear on bib + review
- Captured: **B** — bibliography includes unowned; review excludes by default. Parker note: bibliography will need later work to make this correct (stub citation UX / selection), not assumed done in Session 1.
- Flags: bibliography stub UX follow-up → later session (not Session 1 blocker)

### Q4 — Create-from-queue contract
- Asked: required fields + rating/notes carryover + needs_review
- Captured: **A** — title-only stub; author optional; carry ★ + My Review/Private Notes; `needs_review=false`; never invent ISBN. Genre/year/publisher nullable. `owned=false` at create; toggle to true when physical copy arrives.
- Flags: none

### Q5 — Matched-row field diffs
- Asked: proposal vs direct edit vs ignore; ISBN policy
- Captured: **D** — year/publisher diffs → pending `book_metadata_proposals`; ISBN diffs shown informational only (“CSV had …”), never proposed, never overwrite live ISBN. Session 2+.
- Flags: none

### Q6 — RLS / viewer
- Asked: viewer SELECT for unowned + testing waiver
- Captured: **A + D** — viewers with library read get same owned-only default as owner (opt-in include if filter UI exists); no hard personal-only hide. Viewer RLS smoke waived as known gap until collaborator. Owner-only writes for create/proposals.
- Flags: viewer RLS matrix for `owned` filter → deferred with other library viewer items

### Q7 — Harvard Classics full essay breakout
- Asked: include in owned build vs separate vs defer vs data-only
- Captured: **C** — defer entirely; PLAN Next-up / backlog note only. Orthogonal to owned.
- Flags: none

### Q8 — Session 1 build slice
- Asked: schema-only vs +create vs full (incl matched diffs)
- Captured: **B** — Session 1 = migration + filters/toggle + create-from-queue (rating/notes carryover). Matched year/publisher proposals = Session 2+. Do not create queue rows until Session 1 ships.
- Flags: none

### Q9 — Create-from-queue surface
- Asked: Goodreads settings vs dedicated not-owned page vs Sheet vs script-only
- Captured: **B** — `/settings/library/not-owned` curated from brainstorm queue; per-row Create stub. Compact fields only.
- Flags: none

## Open flags (pending input)
- Bibliography stub correctness (selection, labeling, incomplete citations) → later session after owned ships
- Viewer RLS smoke for owned filter → deferred (known gap)
