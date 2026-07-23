# 134 — Sermons by-book: series label, multi-part dedupe, latest sermon date

**Date:** 2026-07-23
**Module:** sermons
**Tracker session:** ad-hoc (by-book polish after [095](095-sermons-by-book-stats.md))

## Built

- Expanded commentary rows show **series label** (abbreviation when set, else full name).
- **Collapse multi-part / multi-edition** commentaries per Bible book when they share `series_id` + author/editor person-id set (Wenham WBC Genesis vols → 1; Fee NICNT editions → 1). Different series stay separate (Sklar TOTC + ZECOT Leviticus → 2). Standalone (no series) stays one-per-book.
- Collapsed row metrics use the merged unit list; merged display joins unique titles with `; `, keeps max rating, links to the preferred (highest-rated) volume.
- Collapsed spine row shows **most recent sermon date** (`formatYmdMediumChicago`) to the left of the commentary count when the book has ≥1 sermon.

## Decided

- Dedup key = `series_id` + sorted author/editor person ids — not title fuzzy match. Covers multi-volume sets and same-series editions without merging Sklar-style distinct works.
- Header summary still counts distinct preferred `bookId`s on the (already collapsed) per-row lists — multi-book series volumes on different canon books remain separate (ESVEC).
- No schema change.

## Schema changes

- None.

## New components / patterns added

- `collapseCommentaryHits` / `commentaryCollapseKey` in [`src/lib/sermons/by-book.ts`](../../src/lib/sermons/by-book.ts).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Live data already has several multi-part same-series groups (Wenham WBC, Mathews NAC Genesis, Calvin CC reprints) — collapse is immediately visible on Genesis / Psalms / etc.

## Carry-forward updates

- [x] AGENTS.md inventory — collapse helper noted under sermons
- [x] PLAN.md refreshed
- [ ] components.mdc — no new component
- [ ] new env vars — none
