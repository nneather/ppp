# 232 — Library Sep 26 shelf batch

**Date:** 2026-09-26
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20260926213000_library_sep26_shelf_batch.sql` (hosted push):
  - **ConC** *Ecclesiastes* — James G. Bollhagen, Concordia Pub. House 2011 `9780570063872`.
  - **REC** *Job* — Douglas Sean O'Donnell, P&R 2025 `9781629954523`.
  - **ICC** *The Pastoral Epistles* — I. Howard Marshall and Philip H. Towner, T&T Clark Edinburgh 1999 hardcover `9780567086617`. Coverage: 1 Timothy, 2 Timothy, Titus.
  - **NICNT** *Paul's Letter to the Philippians* — Gordon D. Fee, Eerdmans 1995 `9780802825117`.
  - **ZECNT** *Philippians* — George H. Guthrie, Zondervan Academic 2023 `9780310243892`.
  - **FotB** *Philippians* — David W. Chapman, Christian Focus 2012 `9781845506872`. New series Focus on the Bible.
  - *Grammar of Septuagint Greek* — F. C. Conybeare and St. George Stock. Baker Academic paperback 2001 `9780801045929`, original year 1905. Genre **Greek Language Tools**. Subtitle holds the “Selected Readings…” line.
  - Series rename: `CONC` / “Concordia commentary” → **`ConC`** / “Concordia Commentary” (`include_in_citation` stays true; Lockwood 1 Corinthians cites `ConC`).
  - New people: James G. Bollhagen, Philip H. Towner, F. C. Conybeare, St. George Stock.
  - `needs_review = false`. Commentaries `reading_status = reference`. Grammar `unread`.

## Decided

- Marshall shelf copy is the 1999 hardcover, with Towner as second author (not the 2004 paperback).
- LXX grammar is the Baker Academic 2001 paperback, not the Hendrickson 1995 hardcover.
- Concordia abbreviation is **`ConC`**. SBLHS §8.4 does not list CPH Concordia Commentary (`CC` there is Continental Commentaries). `ConC` is the commentary-guide form; [104](104-sbl-series-abbr-cleanup.md) had already flagged all-caps `CONC` as homemade.
- New series abbreviation **`FotB`** (Focus on the Bible). Chapman catalog title is *Philippians*; cover subtitle “Rejoicing and Thanksgiving” is not stored.
- Christian Focus location **Fearn** (the one earlier Christian Focus row, Eswine *Kindled Fire*, still has a blank location).

## Schema changes

- `20260926213000_library_sep26_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None blocking. Grammar is `unread`; flip to `reference` on the book if it should sit with the other language tools.

## Surprises (read these before the next session)

- `author_display` shortens a full middle name to an initial, so stored Douglas / Sean / O'Donnell renders **Douglas S. O'Donnell**.
- “Baker, 1995 paperback” does not match a catalog record. Hendrickson 1995 is `9781565631502`; Baker Academic paperback is **2001** `9780801045929`.
- `book_bible_coverage` has no `deleted_at`. Idempotent coverage checks must not filter that column.

## Carry-forward updates

- [x] Decision + PLAN.md
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none
