# 093 — Goodreads unmatched triage execution

**Date:** 2026-07-18
**Module:** library
**Tracker session:** ad-hoc (follow-on to [089](089-book-rating-ui-goodreads-import.md))

## Built
- Executed triage decisions from `brainstorms/2026-07-17-goodreads-unmatched-triage.md` against hosted prod:
  - People renames/merges (Tolkien, Dostoevsky, Austen, Litfin, Hansen, Bossidy/Charan, Alighieri, Holmes, González, Douglass)
  - Title typo fixes (Verwandlung, Disinherited, Iliad, Renaissance, Singleness, Innocence, Hole in Our Gospel, Zodhiates author_display)
  - Twin consolidation (`copy_count=2` Silver Chair + Orient Express; soft-delete Confronting / Grimm / Brave New World twins)
  - Bulk ratings on existing matches (lanes A–C)
  - Essay breakouts + personal_notes on omnibus/HC parents (Andersen, Sherlock novels, Calvin Acts, Steinbeck, Meditations, Antigone, Burke, Prodigal God, Candide, Underground, Romeo, Wright Knowing Jesus, Roper/More, Ruskin)
  - Added ~26 owned books with ratings (Wingfeather, Tollbooth, Nayeri, Surprised by Joy, NASB, Chester/Allen/Eswine, classics, scores, etc.)
- Matcher polish in `goodreads-csv.ts`: strip Jr./(ed); `of` place-names → personal name; van/von particles; hyphenated surname segments
- Not-owned queue filed: `brainstorms/2026-07-17-goodreads-not-owned-queue.md`

## Decided
- Execution applied ratings/notes/essays/adds directly to hosted DB (pooler), not via UI import re-run
- Not-owned list stays file-only until `owned` flag ships
- Harvard Classics full essay breakout remains a future session

## Schema changes
- None

## New components / patterns added
- None (matcher helpers only)

## Open questions surfaced
- Prefer `book_authors→people` for match keys (still backlog)
- Studies-on-the-Go title-order near-miss matcher (still backlog)

## Surprises (read these before the next session)
- Direct `LIBRARY_DST_DATABASE_URL` needs Session Pooler + SSL from this network (IPv6 / no-encryption on Direct)
- Confessions I% ILIKE also hits Confessions II (II was already ★5)

## Carry-forward updates
- [x] triage brainstorm marked executed
- [x] not-owned queue file
- [x] PLAN.md refreshed
- [ ] `owned` flag plan still Next up
