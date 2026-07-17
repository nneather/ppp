# 089 — Book rating UI + Goodreads import

**Date:** 2026-07-17
**Module:** library
**Tracker session:** ad-hoc

## Built

- Clearer **1–5 star scale** (`<BookRatingScale>`) on book edit form and book detail (replaces number input).
- Book detail: owner can set **rating** (auto-save) and **personal notes** (Save) without opening the full edit form — `updateBookPersonalFieldsAction` (owner-only; B1/B2).
- **Goodreads CSV ratings import** at `/settings/library/goodreads` (owner): preview → confirm → apply. Match by ISBN only (10/13 twins); skip existing ratings by default; optional overwrite; optional fill empty personal notes from My Review / Private Notes.

## Decided

- Keep label **Personal notes** (not “Review notes”) — distinct from metadata `needs_review_note`.
- Goodreads via **CSV export only** (public API is gone). No title/author fuzzy match in v1 — too risky for commentaries / multi-volume sets; unmatched rated rows listed in preview.
- Default **do not overwrite** an existing `books.rating`; opt-in checkbox to overwrite.
- Rating on detail auto-submits; notes require explicit Save (longer text, avoid mid-type clobber).
- **Unowned / research stubs + Goodreads field diffs deferred** (2026-07-17): keep import as ratings-on-ISBN-match only for now. Parker will spin a separate plan for `owned` (hide from search by default), selective create-from-unmatched, and matched ISBN/year/publisher diffs.

## Schema changes

- None (`books.rating` 1–5 + `personal_notes` already in baseline).

## New components / patterns added

- `src/lib/components/book-rating-scale.svelte` — reusable 1–5 star radiogroup + Clear.
- `src/lib/library/goodreads-csv.ts` + `src/lib/library/server/goodreads-import.ts`.
- `isbn10ToIsbn13` / `isbnMatchKeys` in `src/lib/library/isbn.ts`.

## Open questions surfaced

- Whether to later map Goodreads Exclusive Shelf → `reading_status` (deferred).
- Title+author fallback match for ISBN-less Goodreads rows (deferred until needed).
- **Not owned / research citations** — `books.owned`, list default hide, Goodreads unmatched → create stub, matched field diffs — Parker planning separately (see PLAN.md Next up).

## Surprises (read these before the next session)

- Goodreads ISBN cells are often `="978…"` / `=""` — must strip before normalize.
- Rating invalidate on detail must not reset a dirty personal-notes draft (sync notes only on book-id change + successful notes save).
- **`$state(File)` beachballs** after Choose File — Svelte 5 deep-proxies `File`; store with `$state.raw` (fixed same day on Goodreads import page).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented — N/A
- [x] tracker Open Questions — N/A (ad-hoc)
