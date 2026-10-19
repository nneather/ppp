# 249 — Library passage sections (not a second scripture-reference tier)

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc

## Built

- Table `book_passage_sections` — curated book + biblical range + pages + optional label. Reuses `compute_verse_abs()`. Library RLS, audit, soft delete, API grants.
- `/library/search-passage` regrouped into four bands: **Commentaries** → **On this passage** (sections) → **Also covers this book** → **Scripture index**.
- Book detail **Passage sections** list above the scripture-reference index; `<PassageSectionForm>` for add/edit; soft-delete confirm.
- Pure band helpers + parser unit tests.
- Owner smoke: added Sermon on the Mount (Matt 5–7, pp. 103–186) on *The Cost of Discipleship*; Matthew 6:25 search shows Commentaries → On this passage (Bonhoeffer) → Scripture index (Pennington index row).

## Decided

- **Do not** add a `kind` on `scripture_references`. That table stays the OCR/index backload. A second tier there would pollute review counts, OCR, and search sort.
- **Do not** model Bonhoeffer-style sections as essays. Essays are citable articles; bible coverage is whole-book and would over-fire on `/studies/by-book`.
- Passage sections are **not** study sources. Compiled bibliography still cites book XOR essay. Deferred: import-sheet candidates from overlapping sections; footnote page-box prefill from section pages ([paper-source-row](../../src/lib/components/paper-source-row.svelte) page input is still local state).
- Do not surface sections on `/studies/by-book` (whole-book shelf). No hit-rate or auto-attach change.
- Commentary coverage wins over a section for the same book. Index hits are never dropped by a section.
- Pennington Matt 5–7 index row left as-is; he remains a commentary via Matthew coverage.

## Schema changes

- `20261019200000_book_passage_sections.sql` — create table + abs trigger + RLS + grants

## New components / patterns added

- [`src/lib/components/passage-section-form.svelte`](../../src/lib/components/passage-section-form.svelte)
- [`src/lib/library/passage-search-bands.ts`](../../src/lib/library/passage-search-bands.ts)
- [`src/lib/library/server/passage-section-actions.ts`](../../src/lib/library/server/passage-section-actions.ts)

## Open questions surfaced

- When to offer overlapping sections on sermon/paper import (attach the book, dedupe).
- Whether footnote page prefill should prefer the tightest overlapping section when several match.

## Surprises (read these before the next session)

- Migration filename had to sort after already-pushed Oct 19 shelf migrations (`20261019200000_…`) so `db push` did not need `--include-all`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] new env vars — none
