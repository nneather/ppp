# 288 — Hit rate starts January 1, 2027

**Date:** 2026-10-21
**Module:** studies | library
**Tracker session:** ad-hoc (PLAN.md › Next up)

## Built

- Nothing coded. The Used-in fraction still uses raw `books.acquired_on` until the helper below is applied.

## Decided

- Catalog-entry dates stay stored. Do not rewrite them to January 1, and do not hand-date the unused remainder of the library ([287](287-queue-paper-and-acquired-on.md)).
- When a book’s `acquired_on` is still the day the row was entered (`acquired_on = created_at::date`), its hit-rate window starts **2027-01-01**, or that entry day if the book is added later. By then consult and cite should be fully rolling. Sermons already on the books run from 2023-10-25 through 2026-12-20; that stretch is not the baseline.
- A date that is not the catalog default is a real purchase date (the 196 Amazon ISBN rows, or a later hand backfill) and is the window start, including years before 2027. Parker may backfill a year on the books where the January 1 window is too short to be meaningful. An estimated year that is too early counts sermons from before he owned the book.
- Apply this in `hit-rate.ts` the next time that fraction is touched. Do not ship it as a data migration.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None. Which books get an earlier year is Parker’s later pass, not a queue item.

## Surprises (read these before the next session)

- A global `max(acquired_on, 2027-01-01)` would ignore a backfill before 2027. The epoch applies only while `acquired_on` is still the catalog-entry day.

## Carry-forward updates

- [x] components.mdc — no component change
- [x] AGENTS.md — unchanged until `hit-rate.ts` implements the epoch
- [x] new env vars — none
- [x] Studies tracker B1 points here
