# 294 — Sermon commentary shelf

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Sermon detail order is commentaries, then systematic theologies, then sources.
- Commentary rows match By book: title, author, series, stars, hit rate. Attach adds the volume as a source.
- A topical sermon puts that shelf under the systematic hits. A Bible-book picker adds another book’s shelf; the choice stays in localStorage. Remove drops the extra shelf only.

## Decided

- Expository sermons list the primary Bible book’s shelf with no extra-book picker. The passage already names the book.
- Topical sermons still show the passage’s shelf when one is set, and can add other books. Attach is per volume, same as systematic hits.
- Papers stay systematic theologies, then sources.
- The shelf is streamed. Hit rate reuses the By book facts query and does not block the rest of the page.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/sermon-commentaries.svelte` — shelf rows + topical add.
- `src/lib/sermons/server/commentary-shelf.ts` — `loadCommentaryShelves`.
- `GET /studies/commentaries.json?bible_book=` — one book, for the topical picker.
- `src/lib/sermons/commentary-books.ts` — canon filter + localStorage.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- There were no topical sermons in the catalog. Smoke flipped the Nov 15 Grandcote placeholder to topical, added and removed a Romans shelf (local only), then set topical back to false.
- Attach on Matthew 6:25–34 added France and the remove-from-study undo cleared it. Both `study_sources` rows on that sermon are soft-deleted.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker note updated
