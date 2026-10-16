# 239 — Keil and Delitzsch volume parts

**Date:** 2026-10-15
**Module:** library
**Tracker session:** ad-hoc citation correction

## Built
- All 10 Keil and Delitzsch volumes are the Hendrickson set: Peabody, MA, 1996. Volume 8 had been Eerdmans 1978; the other nine had been the 2006 printing of the same edition.
- Volume authors follow who wrote the commentary. Delitzsch: Psalms, Proverbs, Ecclesiastes, Song of Songs, Isaiah, and Job. Keil: the rest. Volume 4 keeps both names because it is mixed.
- 37 biblical-book essays on the multi-book volumes (Psalms and Isaiah stay one book per volume). Essay footnotes name the book (`Delitzsch, "Proverbs," in Proverbs, Ecclesiastes, Song of Songs, K&D 6 …, 45.`). Copy Bibliography on those essays returns the volume entry. A paper that cites two parts of one volume lists that volume once.
- Essay-level bible coverage so `/sermons/by-book` prefers the part. Book-level coverage stays so the library list filter still finds the volumes.

## Decided
- Bibliography unit is the volume when several books in it will be cited. The part title belongs in the footnote.
- Page spans are not stored. The copyright pages are not in hand, and a part-level bibliography would need them.

## Schema changes
- `20261015184500_library_keil_delitzsch_set.sql` — data only (imprint, `book_authors`, essays, essay coverage). Applied to prod.

## New components / patterns added
- Commentary monographs in a series may carry essays. `formatEssayFootnote` / `formatEssayBibliography` treat those as volume parts. The essays section on book detail mounts once rows exist.

## Open questions surfaced
- None. Page ranges can be filled later from the physical volumes.

## Surprises (read these before the next session)
- The essay formatter used to drop the series and print `6:45` on a monograph. Volume parts now keep `K&D 6` and a plain page.
- `created_at` is stepped so the essay list follows canon order. `page_start` is still null, and the loader sorts null pages by `created_at`.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented
- [x] tracker Open Questions — none surfaced
