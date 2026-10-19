# 243 — Studies Session 0 (Phase 0 structure lock)

**Date:** 2026-10-19
**Module:** studies (papers + resource sets + shared study sources)
**Tracker session:** Studies Session 0

## Built

- Phase 0 structure lock for **Studies** — grilled via [brainstorms/2026-10-19-papers-research-tool.md](../../brainstorms/2026-10-19-papers-research-tool.md); all gates answered by owner.
- Tracker: [POS_Studies_Build_Tracker.md](../POS_Studies_Build_Tracker.md).
- No code, no migration in this decision file's Session 0 slice — Session 1 ships `ppp_studies_v1`.

## Decided

- **Paper IS the bibliography container.** Extend `papers`; no separate `bibliographies` or `research_projects` entity. Reuse via import-from-prior-paper.
- **`/studies` nav umbrella** (one sidebar item replaces Sermons; no mobile tab). Tabs: Overview (default) | Papers | Sermons | Sets | By book. Routes under `/studies/*`; 308 redirects from `/classwork/papers*` and `/sermons*`. Data models stay separate (`papers` vs `sermons`); one cross-cut is shared `study_sources`.
- **Resource sets = rule + sticky overrides, computed at read time.** `resource_sets` (name, ORable rules: `bible_book` | `genre` | `topic`, `default_for`, `last_reviewed_at`) + `resource_set_members` (book XOR essay; `include` | `exclude`). Members = rule matches ∪ includes − excludes. Over-firing acceptable.
- **Seeded sets:** 66 "Commentaries: {Book}"; "NT language tools"; "OT language tools"; "Systematic Theology" (Calvin, van Mastricht, Bavinck, Leiden Synopsis, Turretin; `default_for=sermon`, auto-attach on sermon create in Session 3).
- **Sets tab in `/studies`** (not settings) — first-class list/detail; same review component reused in import.
- **Import (Session 2):** Set or prior Paper; auto-named research group; notes copied from prior paper; remove-from-study vs remove-from-set with undo.
- **`paper_sources` → `study_sources`** (paper XOR sermon) + study-scoped groups. Sermons get a detail page sharing sources panel (Session 3).
- **Usage:** `candidate` / `consulted` / `cited` on each source; bib defaults to consulted+cited.
- **`topical` boolean** on papers (default on) and sermons (default off) — steers set suggestions and hit-rate denominator.
- **Passages:** optional `paper_passages`; `role` primary|secondary on both passage tables; `secondary_passage_display` on both parents. Secondary passages excluded from hit-rate denominator.
- **Statuses:** researching / drafting / submitted / published / archived; archived = complete terminal; default list hides archived.
- **`books.acquired_on`** (backfill `created_at::date`) for hit-rate opportunity window.
- **Permissions:** new `studies` module_registry slug for papers + sets + sources (RLS rewrite); sermons keep `sermons`.
- **Export / MCP (Session 4):** clipboard + sectioned `.docx`; `list_studies` / `get_study_sources` / `suggest_sources`.
- **Session arc:** S1 schema + `/studies` shell + Sets UI; S2 paper import + usage; S3 sermon detail + backlinks + hit rates; S4 docx + MCP + Overview polish.

## Schema changes

- None in Session 0 (Session 1 ships `ppp_studies_v1` per tracker sketch).

## New components / patterns added

- None in code. Tracker schema sketch + brainstorm capture.

## Open questions surfaced

- ≤2 per entity on tracker (Systematic Theology seed title match; acquired_on backfill accuracy).

## Surprises (read these before the next session)

- Papers already lived under classwork with orphan support — Studies promotes nav + shared sources rather than inventing a new container.
- Sermon hit-rate requires primary-passage + non-topical studies; secondary passages are display-only for opportunity math.
- Resource sets deliberately do **not** materialize members on INSERT — resolve at read time so new catalog books appear until sticky-excluded.

## Carry-forward updates

- [x] Tracker Phase 0 filed
- [x] PLAN.md refreshed (module row, Next up, Session prompts)
- [x] MODULE_KICKOFF_PLAYBOOK.md active-module pointer updated
- [ ] components.mdc — n/a until Session 1
- [ ] AGENTS.md inventory — until Session 1 code
- [x] new env vars — none
