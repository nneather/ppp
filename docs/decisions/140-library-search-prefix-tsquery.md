# 140 — Library search prefix tsquery (partial last names)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc

## Built

- `/library` keyword search now uses **prefix** full-text matching so partial last names (and title fragments) hit — e.g. `piot` → Nicholas G. Piotrowski, *Return from Exile…*.
- Pure helper [`src/lib/library/search-tsquery.ts`](../../src/lib/library/search-tsquery.ts) `toLibrarySearchTsQuery` + unit tests; wired in `loadBookListFiltered` via `.textSearch(..., { config: 'simple' })` with **no** `type` (PostgREST `fts` → `to_tsquery`).

## Decided

- **Prefix `to_tsquery` over `websearch`/`plain`** — `websearch_to_tsquery('piot')` requires an exact lexeme and returned 0 rows while `author_display` / `search_vector` already contained `Piotrowski`. Rejected reintroducing author-prelude + `ILIKE` (violates [performance.mdc](../../.cursor/rules/performance.mdc) one-round-trip budget).
- **Quoted lexemes** (`'piot':*`) — keeps `*` out of PostgREST filter-DSL misparse; tokens sanitized to letters/digits (incl. Latin-1 supplement) before quoting.
- **AND across tokens** — multi-word `q` still narrows (`return exile` → `'return':* & 'exile':*`).

## Schema changes

- None (existing `books.search_vector` + GIN from `20260603160000_books_list_denorm_search.sql`).

## New components / patterns added

- `src/lib/library/search-tsquery.ts` — client-safe query builder for list FTS.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Full last name `Piotrowski` already worked under `websearch`; the regression was **partial** typing, which is how the search box is normally used.

## Carry-forward updates

- [x] components.mdc updated (N/A — no component)
- [x] AGENTS.md inventory updated
- [x] performance.mdc keyword-search rule updated
- [ ] new env vars documented (N/A)
- [ ] tracker Open Questions updated (N/A)
