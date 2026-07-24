# 156 — Book detail densify (siblings, also-by, peeks)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — owner: empty left column under facts on monograph detail

## Built

- Streamed **series siblings** + **also-by-author** shelf on [`/library/books/[id]`](../../src/routes/library/books/[id]/+page.svelte) (owned-only; sibling links → book detail; series name → list filter; author header + “See all” → `?author_id=`).
- **Section peeks** (Scripture / Bible coverage / Ancient / Topics) only when counts &gt; 0; click scrolls to the section (opens scripture `<details>`).
- **Genre** moved from title eyebrow into first facts `<dl>` row.
- Helpers: [`book-detail-related.ts`](../../src/lib/library/book-detail-related.ts); loaders `loadSeriesSiblingBooks` / `loadAlsoByAuthorBooks`.

## Decided

- Fill blank with shelf navigation, not cross-module widgets (sermons/classwork) or a taller cite strip ([114](114-book-detail-ui-cleanup.md)).
- Omit empty strips entirely — no “No other volumes” placeholders.
- Primary also-by person ids: authors first, else editors; never translators-only.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/book-detail-related.ts` — `primaryAuthorPersonIds`, `siblingBookLabel`, `compareSiblingBooks` (client-safe).
- View-models `BookSiblingRow` / `BookAuthorShelfRow` / `AlsoByAuthorShelf` in `src/lib/types/library.ts`.

## Open questions surfaced

- Owner smoke on a multi-vol series (Institutes) + a commentary with coverage peeks.

## Surprises (read these before the next session)

- Left-column blank was mostly `items-start` + short `<dl>` beside tall status/notes — content fills it; no layout reflow of notes required.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] AGENTS.md inventory updated
- [ ] components.mdc — N/A (page-local)
- [ ] new env vars — none
