# 308 — Commentary lists show owned volumes

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Sermon commentary shelf (`loadCommentaryShelves`, including `GET /studies/commentaries.json`), By book (list, commentary count, four-star count), and Commentaries:{book} set resolution omit `books.owned = false`.
- An essay hit follows the parent book. Parked (`shelf_dismissed`) stays a separate filter on the owned set. Also on the shelf is unchanged.
- Coverage embeds now select `owned`. The check is `commentaryCoverageOwned` in `src/lib/sermons/commentary-owned.ts`.

## Decided

- Not-owned commentaries stay in the library and on any paper that already cites them. This pass does not soft-delete them or set `shelf_dismissed`.
- Also on the shelf still lists every non-commentary coverage row, owned or not. A not-owned commentary does not fall through into that list.
- 307 was already taken. This note is 308.

## Schema changes

- None. The inheritance-paper migrations were not edited.

## New components / patterns added

- `src/lib/sermons/commentary-owned.ts` — owned gate for commentary lists. An essay reads the parent book.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Colossians coverage included McKnight NICNT, Wright TNTC, Foster BNTC, and Pao ZECNT only because those rows are `genre = Commentary` with `owned = false`. Matthew Henry stays parked and owned, so he still belongs in the Dismissed disclosure.
- The inheritance paper’s cited sources are `study_sources` rows. They do not go through this gate.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker follow-on ticked
