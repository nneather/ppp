# 092 — Commentary batch upload (no-ISBN shelf)

**Date:** 2026-07-18
**Module:** library
**Tracker session:** Ad-hoc — add physical commentaries without ISBN lookup flow

## Built

- Added **8** Commentary monographs (clean confirm, `needs_review = false`) with authors, series, ISBNs, and `book_bible_coverage`.
- New series: **Black's New Testament Commentaries** (`BNTC`), **Classic Commentary Library** (`CCL`), **IVP New Testament Commentary** (`IVPNTC`).
- Existing **Haggai, Zechariah 1–8** (Meyers/Meyers, AB) already present — set `volume_number = 25B` only.

| Title | Author(s) | Series | Year | Coverage |
|---|---|---|---|---|
| 1, 2 Samuel | Robert D. Bergen | NAC 7 | 1996 | 1–2 Samuel |
| The Epistles of Peter and of Jude | J. N. D. Kelly | BNTC | 1969 | 1–2 Peter, Jude |
| The Epistle of St. Paul to the Galatians | J. B. Lightfoot | CCL | 1974 (orig. 1865) | Galatians |
| Revelation | J. Ramsey Michaels | IVPNTC 20 | 1997 | Revelation |
| The Epistle to the Romans | John Murray | NICNT (combined) | 1968 (orig. 1959) | Romans |
| The Letter to Titus | Jerome D. Quinn | AB 35 | 1990 | Titus |
| The Epistles of John | Raymond E. Brown | AB 30 | 1982 | 1–3 John |
| Mark | C. S. Mann | AB 27 | 1986 | Mark |

## Decided

- Murray: **combined one-volume** NICNT-era Eerdmans (not original 2-vol set; not ECBC/WSP reprint).
- Lightfoot: attach **Classic Commentary Library**; `year = 1974` printing, `original_year = 1865`.
- Kelly: original **A. & C. Black** 1969; series **Black's New Testament Commentaries** (`BNTC`).
- Anchor vols: **Doubleday** imprint; keep series **Anchor Bible** (`AB`).
- Quinn coverage: **Titus only** (despite Pastorals intro).
- Fill confident ISBNs (checksum-validated); leave publisher registry unlinked (text + location, matching other AB/NAC rows).
- Do **not** reuse existing `NTC` (Hendriksen/Baker) for IVP — new `IVPNTC`.

## Schema changes

- None (DML only).
- `20260718232635_library_commentary_batch_no_isbn.sql` — series/people/books/authors/coverage + Meyers volume fill.

## New components / patterns added

- None.

## Open questions surfaced

- None blocking. Optional later: link Broadman/Doubleday/`A. & C. Black` into `publishers` registry.

## Surprises (read these before the next session)

- Meyers *Haggai, Zechariah 1–8* was already in the library (complete authors + coverage); only volume was missing.
- Existing Michaels person row (`first_name = 'J.'`, `middle_name = 'Ramsey'`) denorms to **J. R. Michaels** via `author_display` — pre-existing quirk, not new data.
- Brown Doubleday ISBN-10 is `0385056869` (not `…861`); ISBN-13 `9780385056861`.

## Carry-forward updates

- [ ] components.mdc updated — N/A
- [ ] AGENTS.md inventory updated — N/A
- [ ] new env vars documented — N/A
- [x] PLAN.md refreshed
