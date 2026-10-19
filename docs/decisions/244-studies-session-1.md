# 244 — Studies Session 1 (schema + /studies shell + Sets)

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** Studies Session 1

## Built

- Migration `20261019180000_ppp_studies_v1.sql` applied on hosted prod. `studies` module slug. Papers, groups, and sources RLS moved from `classwork` to `studies` (owner write, `app_has_module_read('studies')` select). Sermons keep `sermons`.
- `paper_sources` → `study_sources` (paper XOR sermon, `usage` default `candidate`). `paper_research_groups` → `study_research_groups` (paper XOR sermon).
- `resource_sets` + `resource_set_members` (include/exclude overrides only). Members resolve at read time.
- `paper_passages`; `role` primary|secondary on both passage tables; `secondary_passage_display`; `topical` (papers default true, sermons default false).
- Paper statuses: researching / drafting / submitted / published / archived. Existing `draft` → researching, `in_progress` → drafting. Default list hides archived.
- `books.acquired_on` backfilled from `created_at::date` (1570 rows). New rows default to `current_date`.
- Seeds: 66 `Commentaries: {Book}` sets from `bible_books` (names match `BIBLE_BOOK_NAMES`). NT language tools = genre Greek Language Tools. OT language tools = genre Hebrew Language Tools. Systematic Theology is a static include set, `default_for={sermon}`, **18** live volumes (Calvin Institutes, van Mastricht Theoretical-Practical Theology, Bavinck Reformed Dogmatics, Leiden Synopsis, Turretin Institutes of Elenctic Theology — exact title + genre Systematic Theology).
- `/studies` tabs Overview | Papers | Sermons | Sets | By book. Papers and sermons pages moved. 308 from `/classwork/papers*` and `/sermons*` (`/sermons/by-book` → `/studies/by-book`). Desktop sidebar Studies replaces Sermons. Classwork Papers chip and assignment “Open research paper” point at `/studies/papers`.
- Sets list grouped Bible books (canon) / Language / Custom with counts and “N new”. Detail uses `<ResourceSetReview>` (rule chips, remove = sticky exclude, add-back, Save review stamps `last_reviewed_at`). Never-reviewed sets badge 0 new so the seed is quiet.
- Audit log Studies filter + soft-delete revert for the new table names. Legacy `paper_sources` / `paper_research_groups` names stay in the filter so old rows still show.

## Decided

- Bible-book rules store only `{kind:bible_book, value}`. The resolver applies genre Commentary and `collapseCommentaryHits`, same as By book.
- Language seeds are Greek (NT) and Hebrew (OT) only. Latin, German, and Chinese language tools stay out until Parker adds a rule or a custom set.
- `last_reviewed_at` null means “not reviewed yet,” and the new-count is 0. A badge appears only after Save review, for catalog rows created later.
- Removing a static include flips that override to `exclude` (so Add back can restore it). Removing a rule match inserts an exclude. Restoring a rule match soft-deletes the exclude.
- Sets list/detail may exceed the 4-query page budget. Commentary resolution is the same shape as `/studies/by-book` (coverage + authors).

## Schema changes

- `supabase/migrations/20261019180000_ppp_studies_v1.sql` — applied. Types regenerated.

## New components / patterns added

- `src/lib/components/studies-nav.svelte` — tab chips.
- `src/lib/components/resource-set-review.svelte` — set detail review (reused by Session 2 import).
- `src/lib/studies/resource-sets.ts` plus server loaders/actions. Paper helpers live under `src/lib/studies/` with classwork re-exports.

## Open questions surfaced

- B1 still open: `acquired_on` backfill is `created_at::date`. Parker hand-corrects notable commentaries.
- Latin / German / Chinese language tools are not in the NT/OT sets.

## Surprises (read these before the next session)

- Systematic Theology matched 18 volume rows, not 5 titles. That is the multi-volume sets (3+5+4+3+3).
- Renamed tables keep historical `audit_log.table_name` values (`paper_sources`, `paper_research_groups`). The Studies filter includes both names. Soft-delete revert targets the new names only.
- Viewers who could read papers via `classwork` no longer can until they have `studies` read. Permissions UI includes the new slug (default none).

## Verification

- `npm run supabase:db:push:dry` then push. `npm run supabase:gen-types`.
- `npm run check` — 0 errors / 0 warnings.
- `npm run test` — 582/582 (7 new resource-set tests).
- `npm run build` — completed.
- Bugbot ([review](74348ce8-eebd-4dd0-aa56-5c301709d6e4)): paper status badge classes still keyed `draft` / `in_progress`. Fixed to the new statuses.
- Security review ([review](87bffdf6-6147-4c45-b1c5-7fbac4c1cb04)): no medium-or-higher findings. Staging `test:rls` does not cover `studies` yet — add it before granting a viewer `studies` read.
- Sets in prod: 66 bible_book, 2 language, 1 custom; Systematic Theology 18 includes.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker Session 1 ticked
