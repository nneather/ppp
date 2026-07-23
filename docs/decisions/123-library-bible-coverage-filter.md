# 123 — Library list Bible coverage filter

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc

## Built
- `/library` Filters panel: **Bible book coverage** MultiCombobox (66 canon names from layout `bibleBookNames`).
- URL facet `?bible_book=Romans` (repeated / CSV; validated against `BIBLE_BOOK_NAMES`).
- `loadBookListFiltered` resolves matching `book_bible_coverage.book_id`s (OR within selected books; AND with author/other facets; essay-only coverage excluded).
- Active-filter chips + clear-all include coverage selections.
- Unit tests: `src/lib/library/__tests__/url-params.test.ts`.

## Decided
- **Coverage facet on the book list**, not a redirect to `/library/search-passage` — passage search is verse-overlap + coverage merge; this filter is “books that cover book X as a whole.”
- **Reuse author-facet ID narrowing** (lookup → `.in('id', …)`) rather than `book_bible_coverage!inner` on the list select — avoids duplicate parent rows when multiple bible books are selected, and matches the existing author ∩ facet intersection pattern.
- **Essay-only coverage out of scope** for this list filter (`book_id IS NOT NULL` only). Parent volumes with essay-level coverage still surface via `/library/search-passage` and sermons by-book.

## Schema changes
- None. Table is small (~hundreds of coverage rows); no new index. Revisit `CREATE INDEX … ON book_bible_coverage (bible_book) WHERE book_id IS NOT NULL` if the facet becomes a hot path.

## New components / patterns added
- None. Reuses `<MultiCombobox>` (same as Series / Author).

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- None.

## Carry-forward updates
- [x] components.mdc updated (MultiCombobox blurb)
- [x] AGENTS.md inventory updated (`url-params` bible_book note)
- [ ] new env vars documented
- [ ] tracker Open Questions updated
