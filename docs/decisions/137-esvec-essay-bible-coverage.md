# 137 — ESVEC essay-level bible coverage + by-book signed hits

**Date:** 2026-07-23
**Module:** library / sermons
**Tracker session:** ad-hoc

## Built

- Migration `20260723214723_library_esvec_essay_bible_coverage.sql`: essay-level `book_bible_coverage` for all ESVEC essays whose `essay_title` matches a Protestant `bible_books.name` (**66** rows — full set).
- `/sermons/by-book` loader:
  - Essay hits inherit parent `genre` / `rating` / series label.
  - Parent `genre === 'Commentary'` → **Commentaries** (was always Also on the shelf).
  - `preferEssayHitsOverParentBooks()` drops the multi-book volume row when a signed essay covers the same Bible book (ESVEC + NIB Wright no longer double-list).
- Commentaries list key → `` `${kind}-${essayId ?? bookId}` `` (also-on-shelf already used this).
- Unit test for essay-over-volume prefer.

## Decided

- ESVEC was already essay-modeled; missing piece was essay-level coverage (NIB Vol X had it from [088](088-commentary-bible-coverage-cleanup.md)).
- Signed commentary essays belong under Commentaries with series abbr + contributor, not Also on the shelf.
- Prefer essay hit over parent volume on the same Bible book (cleaner spine; volume still has book-level coverage for library filters).

## Schema changes

- DML only — no typegen.

## New components / patterns added

- `preferEssayHitsOverParentBooks` in [`src/lib/sermons/by-book.ts`](../../src/lib/sermons/by-book.ts) — used inside `collapseCommentaryHits`.

## Open questions surfaced

- Vol 1 ESVEC essay↔author mapping may be wrong vs contributor notes (Sklar/Exodus etc.) — shelf/catalog check later; coverage titles are correct.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
