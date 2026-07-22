# 095 — Sermons Session 2: by-book commentary × sermon stats

**Date:** 2026-07-19
**Module:** sermons
**Tracker session:** Session 2

## Built

- Route `/sermons/by-book` — Protestant canon spine (66 rows always) with sermon counts, Commentary coverage (4★+ cue), expandable lists, and collapsible **Also on shelf** (essays + non-Commentary coverage).
- Shared **List | By book** control (`<SermonsViewToggle>`) on `/sermons` and `/sermons/by-book`.
- List filter `?bible_book=` (drill-down from by-book sermon count); clear chip + link back.
- Loader `loadByBookStats` aggregates `sermon_passages` + `book_bible_coverage` (no new tables); pure sort/filter in `src/lib/sermons/by-book.ts`.
- Sticky sort (Canon | Sermons | Commentaries | 4★+, bidirectional) + filters (OT | NT | Has sermons | No commentaries | Has 4★+); header summary totals.
- Unit tests: `src/lib/sermons/__tests__/by-book.test.ts`.

## Decided

- Follow grill [brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md](../../brainstorms/2026-07-17-commentary-sermon-stats-dashboard.md): Bible book as primary unit; Commentary genre + live coverage for primary list; Biblical Reference → Also on shelf; sermon attribution only via structured passages.
- Prefetch all coverage details in the loader; client sorts/filters the payload via URL params (no materialized view).
- One-row expand; Also on shelf nested disclosure; expand state not persisted.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/sermons-view-toggle.svelte` — List | By book nav control.
- `src/lib/sermons/by-book.ts` — pure filter/sort/URL helpers.
- Types: `ByBookRow`, `ByBookShelfHit`, `ByBookListFilters`, `ByBookSummary` in `src/lib/types/sermons.ts`.

## Open questions surfaced

- Chapter/verse-scoped shelf surfacing (Bonhoeffer Matt 5–7) remains deferred (grill open flag).

## Surprises (read these before the next session)

- Essay coverage embeds use `books!essays_parent_book_id_fkey` from `book_bible_coverage` → `essays` → parent book.
- Writing-session gaps took decision **094**; this session is **095**.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [x] tracker Session 2 marked done
- [ ] new env vars — none
- [ ] Owner: re-smoke by-book labels + ranged Find-in-library after [110](110-sermons-owner-smoke-ux.md)
