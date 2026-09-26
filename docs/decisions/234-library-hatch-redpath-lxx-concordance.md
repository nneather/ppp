# 234 — Hatch–Redpath LXX concordance

**Date:** 2026-09-26
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20260926225000_library_hatch_redpath_lxx_concordance.sql` (hosted push):
  - One set row: *A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)* — Edwin Hatch and Henry A. Redpath.
  - Baker Book House, Grand Rapids, MI, 1983 reprint. `original_year` 1897. ISBN `9780801042706`. `total_volumes` 2.
  - Genre **Greek Language Tools**. `reading_status` reference. `needs_review` false.
  - New people: Edwin Hatch; Henry / A. / Redpath. Did not reuse Nathaniel O. Hatch.

## Decided

- One catalog row for the set, not a row per physical book. `total_volumes` 2 is the two Baker books (vol. 1, and vols. 2–3 bound together).
- Imprint is **Baker Book House** (1983 title page). Other Baker rows in the library use Baker Academic or Baker Books.
- `original_year` is 1897 (vols. 1–2). The supplement (vol. 3) is 1906; the column holds one year.
- Genre matches *The Englishman’s Greek Concordance* (Greek Language Tools), not the ESV exhaustive concordance (Biblical Reference).
- This is the unmodified Baker reprint, not the 2005 Baker Academic second edition that adds the Muraoka index.

## Schema changes

- `20260926225000_library_hatch_redpath_lxx_concordance.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- Some catalogs hang ISBN `9780801042706` on both the 1983–1991 Baker Book House reprints and the 2005 supplemented edition. The shelf copy is the 1983 reprint.

## Carry-forward updates

- [x] Decision + PLAN.md
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none
