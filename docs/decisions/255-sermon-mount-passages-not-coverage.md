# 255 — Sermon on the Mount books are passages, not whole-Matthew coverage

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (follow-on to [254](254-passage-sections-wave-2.md))

## Built

- Robert Guelich, *The Sermon on the Mount: A Foundation for Understanding* (Word, 1982). One section: Matthew 4:23–7:29, pp. 41–422 (commentary span; bibliography begins p. 423). A first insert of nine pericopes was soft-deleted the same day. Matthew coverage removed. Genre stays **Commentary**.
- Jonathan Pennington, *The Sermon on the Mount and Human Flourishing*. One section: Matthew 5:1–7:29, pp. 1–326. Matthew coverage removed. Genre stays **Commentary**. His last contents chapter is titled through 8:1; the stored range stops at 7:29 with Augustine.
- Augustine, *The Lord's Sermon on the Mount*: genre **Historical Theology → Commentary**. The two passage sections from [254](254-passage-sections-wave-2.md) stay (Book I Matt 5; Book II Matt 6–7). No bible-book coverage. Standalone-commentary footnotes match a monograph note when there is no series.
- Catalog ISBN on Guelich corrected **9780849901195 → 9780849901102** (0-8499-0110-3). Year and publisher were already the 1982 Word edition.

## Decided

- A book whose subject is one passage keeps the Commentary genre and loses whole-book coverage. Sections carry the search.
- These three books are one sermon, not a Matthew commentary and not a pericope outline. Augustine stays two rows because the treatise is Book I and Book II. Guelich and Pennington are one row each.
- *Nachfolge* on the shelf is the Brunnen Zimmerling edition (ISBN 9783765509483; “Brunner” in conversation is that publisher). Still no print contents for that 320-page book. Kaiser and DBW paginations stay unused.
- *Paul and the Person* (Eerdmans 2017, xvi + 207) still has no chapter-start pages. Interior citations only: Romans 7 at least 113–124, Philippians 2 at 129 and 150, Galatians 2 at 152–160, conclusion by 178.

## Schema changes

- None (data only).

## New components / patterns added

- Skill rule updated: a Sermon-on-the-Mount commentary is one section, genre stays Commentary, whole-book coverage comes off.

## Open questions surfaced

- Brunnen *Nachfolge* and Eastman: contents pages from the shelf copies.
- Pennington’s page end is the OCLC collation (xx, 326) shared by ISBN 9781540960641. Baker’s paperback listing says 352 pages. Correct `page_end` if the last printed page differs.
- Pennington’s commentary chapter 11 is titled Matthew 7:13–8:1. The stored range ends at 7:29.

## Surprises (read these before the next session)

- The stored Guelich ISBN was one digit off the 1982 Word cloth ISBN. The contents pages belong to 9780849901102.
- `book_bible_coverage` has no `deleted_at`. Removing coverage is a real DELETE (same as `softDeleteBibleCoverageAction`).

## Carry-forward updates

- [x] decision filed
- [x] PLAN.md refreshed
- [x] skill updated
- [ ] components.mdc — n/a
- [ ] new env vars — none
