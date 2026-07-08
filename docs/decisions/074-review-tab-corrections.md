# 074 — Review tab corrections

**Date:** 2026-07-08
**Module:** library
**Tracker session:** Ad-hoc — review-queue polish

## Built

- **Five new genres** (52 values, was 47): `Christology`, `Ecclesiology`, `Hobbies`, `Pneumatology`, `Self-Help` — `GENRES` in `src/lib/types/library.ts` + migration `20260708140000_library_review_genre_expansion.sql`.
- **Clickable review title** — `<h2>` links to `/library/books/[id]/edit?returnTo=…` on every deck (incl. Genre Sprint). Edit page shows "Back to review" when `returnTo` is a `/library/review` path; post-save `goto(returnTo)` when set.
- **"Needs shelf" button** — `markNeedsShelfAction` keeps `needs_review = true`, appends `Verify at shelf` to `needs_review_note` when no shelf marker present (`ensureShelfMarkerNote` in `review.ts`), advances the card locally. `formaction="?/markNeedsShelf"` on the main review form (no nested forms).
- **Genre-confirm stall hardening** — `reviewFormSubmit()` injects `editGenre` into `FormData` before POST (eliminates hidden-input race after chip tap / Tab+Enter); failure/error toasts; `try/finally` always clears `pendingSaveId`. "Field wrong" / "Edit full" use `goto()` instead of `href` to avoid accidental Enter navigation.

## Decided

- **Shelf defer keeps the review flag** — unlike Confirm, "Needs shelf" does not clear `needs_review`; the book lands in the existing `?shelf=only` deck via the `shelf` substring marker ([067](067-library-review-sprint-decks.md)).
- **No `REVIEW_TOP_GENRES` change** — new genres appear under Genre Sprint "More…" only.
- **Single form + `formaction`** for Needs shelf — rejected nested `<form>` inside the review card (hydration warning).

## Schema changes

- `20260708140000_library_review_genre_expansion.sql` — `books_genre_check` extended with 5 genres.

## New components / patterns added

- `ensureShelfMarkerNote` + `SHELF_DEFER_LINE` in `src/lib/library/review.ts`.
- `markNeedsShelfAction` in `src/lib/library/server/book-actions.ts`.
- Unified `reviewFormSubmit()` enhance dispatcher on `/library/review`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Nested `<form>` for Needs shelf triggered svelte-check SSR placement warnings — `formaction` on a submit button inside the existing review form is the correct pattern.

## Carry-forward updates

- [ ] components.mdc updated — n/a
- [x] AGENTS.md inventory updated
- [ ] new env vars documented — n/a
- [ ] tracker Open Questions updated — n/a
