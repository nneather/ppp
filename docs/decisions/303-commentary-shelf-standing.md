# 303 — Commentary shelf standing

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- `books.shelf_dismissed` and `essays.shelf_dismissed` (default false). A viewer cannot change the book column (`enforce_books_viewer_columns`). Essays stay owner-write, so they need no extra guard.
- Matthew Henry (series abbreviation `MHC`, six live volumes) is seeded parked.
- Collapsed commentary sets carry every member book and essay id. The set is parked only when every member is. Dismiss by default and a star rating write every member. An essay parks the essay, not the parent volume.
- By book counts, the row chip, and the sermon card count active (not parked) hits. Four-star totals ignore parked hits. An open Bible book lists Active, then a closed Dismissed disclosure.
- Sermon rows: compact stars, Attach, and Dismiss for this sermon only (localStorage). Show dismissed brings back parked rows and this sermon’s hides. Restore clears the local hide. Attach does not un-park.
- By book rows: compact stars and Dismiss by default / Use by default. Owner only. Parked hits stay out of import suggestions.

## Decided

- Parked is a property of the commentary in Postgres. Hidden-for-this-sermon matches systematic dismiss and does not change the By book count.
- Use by default lives on By book. The sermon row does not un-park.
- Stars write `books.rating` (an essay row rates the parent book, which is what the shelf already shows). Clicking the current compact star clears it.
- 300–302 were already taken. This note is 303.

## Schema changes

- `supabase/migrations/20261023222235_commentary_shelf_dismissed.sql` — two booleans, viewer trigger, MHC seed. Applied on the hosted project. Types regenerated.

## New components / patterns added

- `src/lib/components/commentary-shelf-hit.svelte` — shared sermon and By book row.
- `src/lib/sermons/commentary-dismiss.ts` — per-sermon hide.
- `src/lib/sermons/server/commentary-shelf-actions.ts` — `setCommentaryRating` / `setCommentaryShelf`, wired on the sermon page and By book.
- Compact variant of `book-rating-scale.svelte`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Run a security-review pass on `enforce_books_viewer_columns` before this migration’s commit is pushed. The trigger still bypasses when `auth.uid()` is null (migrations) and when `app_is_owner()`.
- Closed `<details>` still lays out its contents in this browser. Clicks have to open the card first.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker note updated
