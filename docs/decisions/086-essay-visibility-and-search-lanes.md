# 086 — Essay visibility, compact filters, and article discovery in search

**Date:** 2026-07-17
**Module:** library
**Tracker session:** ad-hoc (essay discovery / filters)

## Built

- **Book detail essay visibility** — `<BookEssaysEditor>` opens by default (no longer collapses when essays exist); `#essay-<uuid>` deep-link scroll + highlight; eyebrow shows work type + article count; near-title preview list (first 3 + “and N more”) linking into the essays section.
- **`/library` filter panel** — desktop Filters collapsed by default; genre chips show curated `LIBRARY_FILTER_TOP_GENRES` first, with **More genres (N)** expanding the rest; active out-of-top genres stay visible in the primary row.
- **`list-filter-genres.ts`** + unit tests.
- **Single-box article discovery** — when `q` is set, `loadEssaySearchHits` runs in parallel with book FTS (essay title ILIKE + essay-author last name). `/library` shows an **Articles in volumes** group (cap 20) above books; rows deep-link to `/library/books/[parent]#essay-<id>`. Wired through SSR load + `/library/books.json` (first page only). Main `books.search_vector` path unchanged.

## Decided

- **One search box, not three lanes.** An earlier draft locked separate Author / Title lanes; that duplicated book FTS and hid Leviticus/Palmer behind the wrong box. Rejected in favor of:
  1. **Main `q`** — today’s `books.search_vector` FTS (fast path, unchanged).
  2. **Parallel essay query** only when `q` is non-empty — title + essay authors; separate result group.
- **Do not** fold essay text into `books.search_vector` — preserves the one-round-trip book list budget ([044](044-pwa-responsiveness.md) / performance.mdc).
- **Author facet (`author_id` chips)** — still book-authors only; essay-only people surface via keyword `q` in the Articles group.
- **Optional later:** “Articles only” chip; extend author facet to `essay_authors` — refinements, not parallel search UIs.

## Schema changes

- None (ILIKE on current essay volume is enough; add `pg_trgm` on `essays.essay_title` if the corpus grows large).

## New components / patterns added

- [`src/lib/library/list-filter-genres.ts`](../../src/lib/library/list-filter-genres.ts) — top/overflow genre helpers for `/library`.
- `EssaySearchHit` + `loadEssaySearchHits` in [`loaders.ts`](../../src/lib/library/server/loaders.ts).
- Essay preview strip on [`/library/books/[id]`](../../src/routes/library/books/[id]/+page.svelte).

## Open questions surfaced

- None blocking. Dictionary/`s.v.` discovery rides the same essay-title path once those rows exist.

## Surprises (read these before the next session)

- Essays section previously **auto-closed when essays existed** (`essaysOpen = essays.length === 0 || …`) — that was the main visibility bug, not placement.
- ESVEC-style essay titles are often bible book names (`Leviticus`), so keyword search finds chapters without bible-coverage wiring.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars documented — N/A
- [x] PLAN.md refreshed
