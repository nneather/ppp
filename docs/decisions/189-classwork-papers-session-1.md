# 189 — Classwork research papers Session 1 (publication surface)

**Date:** 2026-08-01
**Module:** classwork (papers / paper-scoped bibliography)
**Tracker session:** Papers Session 1

## Built

- Migration `20260801120600_ppp_classwork_papers_v1.sql` — `papers`, `paper_research_groups`, `paper_sources` per the [188](188-classwork-research-papers-session-0.md) sketch: XOR `book_id`/`essay_id` CHECK, partial uniques (`assignment_id` 1:1; `(paper, book)` / `(paper, essay)` while live), classwork RLS shape, grants, `set_updated_at` + audit triggers, partial indexes. Applied to hosted; `gen-types` regenerated. Groups tables schema-only (UI is Session 2).
- `/classwork/papers` — list (status badge, course, effective due, source count) + `<PaperFormSheet>` create/edit.
- `/classwork/papers/[id]` — research home: paper header + notes; source search-and-attach (`?src_q=` server search via `loadBookListFiltered` `includeUnowned` + `loadEssaySearchHits`, 8 hits each); per-row **Footnote / Short / Bib** copy with page input; per-source research notes; not-owned stub create+attach (free-form title/author/year); **Copy bibliography** (flat Turabian, books + essays merged, HTML + plain clipboard); confirm-gated source remove + paper delete.
- Assignment **Open research paper** (create-or-open 1:1) — button in `<AssignmentFormSheet>` edit mode for `kind='paper'`, posts to `/classwork/papers?/openResearchPaper` → 303 to the detail page. Rendered as a sibling form (nested forms are invalid HTML).
- `<ClassworkViewToggle>` Assignments | Papers on `/classwork` and `/classwork/papers` (sermons-view-toggle pattern).
- `src/lib/classwork/paper-bibliography.ts` — `formatPaperBibliographyEntries` / `compilePaperBibliography` merge-sort helper + 5 unit tests.
- Audit-log UI: `_CLASSWORK_TABLES` + `_SOFT_DELETE_REVERTIBLE_TABLES` + `entityLabelFor` cases for the three tables.

## Decided

- **P1 resolved — stamp + lock while linked** (owner multiple-choice): server re-stamps `course_id`/`due_date` from the assignment on **every** save while `assignment_id` is set (submitted values ignored); Sheet shows both as read-only "from assignment"; on unlink the last-synced values stay and become editable. Rejected copy-once (drift) and pure-derive (loses queryable columns on orphan transition).
- **Compiled bib merge lives in classwork** (`compilePaperBibliography`), not by widening library's books-only `formatCompiledBibliography`. Essay sort key = essay-author last name → volume year (pub ∨ reprint ∨ original) → essay title; same comparator as `sortBibliographyInputs`. Unsigned essays (BDAG s.v.) format to empty bib entries and are dropped — note-only citations, matching [163](163-bdag-sv-essay-bib-greek-nfc.md).
- **Attach UX = URL-driven server search** (`?src_q=`, GET form with keepfocus) reusing existing loaders — no new typeahead component, no client-side catalog download.
- **Not-owned stub from the paper page is free-form** (title required, author/year optional); the curated-queue action (`createNotOwnedStubAction`) stays untouched. Stub dedupes by `normalizeTitleKey` against the live catalog and attaches the existing book instead of duplicating.
- **Attach dedupe via revive-by-PK** (footgun NEW-D): prior soft-deleted junction row is revived (`deleted_at=null`, `group_id` cleared, notes preserved) instead of inserting past the partial unique.
- **Open research paper only for `kind='paper'`** in the assignment sheet — other kinds link from the paper Sheet's assignment picker instead.
- **Round-trip exception (performance.mdc):** paper detail hydrates one `loadBookDetail` per distinct book (parallel `Promise.all`). Papers hold tens of sources; reusing the canonical citation mapping (publisher resolve, effective series abbreviation, author hydration) beats duplicating it into a batched loader that could drift from Turabian output.
- **No Cite-set checkbox on paper rows v1** — multivolume `N vols.` bib stays on book detail.
- Delete on the **detail page only** (list rows just edit/navigate); paper soft-delete cascades to live sources + groups in the action.

## Schema changes

- `supabase/migrations/20260801120600_ppp_classwork_papers_v1.sql` — three tables above; no new `module_registry` slug (rides `classwork`).

## New components / patterns added

- `src/lib/components/classwork-view-toggle.svelte` — Assignments | Papers chip toggle.
- `src/lib/components/paper-form-sheet.svelte` — paper create/edit Sheet with assignment-linked lock states.
- `src/lib/components/paper-source-row.svelte` — source row: Turabian cite buttons + page input + research note editor + remove.
- `src/lib/components/paper-add-source-panel.svelte` — catalog search results + attach + not-owned stub form.
- `src/lib/classwork/paper-sources.ts` — `PaperSourceView` client-safe view-models; `paper-bibliography.ts` — merged compile.
- `src/lib/classwork/server/paper-loaders.ts` / `paper-actions.ts` — loaders + `{ kind, success?, message?, …Id }` actions.

## Open questions surfaced

- G1 (group soft-delete: null out vs block) — unchanged, Papers Session 2.

## Surprises (read these before the next session)

- The **user-supabase MCP is read-only** (`cannot execute SELECT in a read-only transaction` on UPDATE CTEs) — smoke-data cleanup had to go through the app's own delete flows (which is better for the audit trail anyway).
- `formatEssayBibliography` returning `''` for unsigned essays made the compile filter trivial — no special-casing needed beyond dropping empty entries.
- The assignment sheet is one big `<form>`; the Open-research-paper button had to be a **sibling** form between header and body — nested forms silently break submission.

## Verification

- `npm run check` 0 errors; `npm run test` 425 passed (5 new).
- **Bugbot pass (>400 LOC gate)** — two medium findings, both fixed in-session: (1) cross-route “Open research paper” failures now surface in the assignment sheet's error strip (`assignmentSheetError` includes `openResearchPaper`); (2) sources whose catalog book/essay was soft-deleted come back as `orphans` from `loadPaperSourceViews` and render as a removable "Unavailable source" row instead of silently disappearing while still holding the partial unique + counts.
- Mobile smoke (390×844, browser agent): 12/12 steps pass — create/edit/delete paper, attach book + essay search, notes, stub + Not-owned badge, Attached dedupe, confirm dialogs, both toggles; no console errors or layout breakage. Clipboard toasts surfaced the error path (automation has no document focus).
- `audit_log` rows confirmed for `papers` INSERT/soft-delete and `paper_sources` INSERT/notes-UPDATE/soft-delete, all with `changed_by` set.
- Viewer RLS: same classwork policies; solo waiver unchanged (not re-tested — no collaborator).

## Carry-forward updates

- [x] Tracker Papers Session 1 ticked (+ P1 answered)
- [x] PLAN.md refreshed (module row, Recent decisions, prompt removed, repo gate)
- [x] AGENTS.md inventory — classwork papers helpers
- [x] components.mdc — four new components
- [x] new env vars — none
