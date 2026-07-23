# 116 — Commentary consistency Batch 1

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — commentary metadata uniformity pass

## Built

- Migration `20260722220157_library_commentary_consistency_batch1.sql`:
  - **WBC** — filled `volume_number` for 13 volumes; Hobbs title → `2 Kings` + vol `13`; cleared Hawthorne Philippians subtitle leak.
  - **NAC** — vols `1A`/`1B`/`2`/`5`/`6` for Mathews/Stuart/Howard/Block.
  - **AB** — vols for Judges, Ezra-Nehemiah, Luke I–IX, John I–XII, Ben Sira, Judith, Esdras; Bright Jeremiah → `21`.
  - **ApOTC** — Wray Beal Kings → `9`.
  - **Yarbrough** *Letters to Timothy and Titus* moved **BECNT → PNTC** (ISBN/publisher confirmed Pillar).
  - Cleared junk `introduction and commentary.` subtitles on NIBC + REC Deuteronomy.
  - Fixed people row `Fitzmyer.` → `Fitzmyer`.
  - **Merged** Bright AB Jeremiah dup: kept Doubleday + subtitle row; soft-deleted `Double Day` twin.

## Decided

- Title/subtitle house style **A**: short biblical titles for series vols; real title-page subtitles only; **do not normalize** odd title forms (Turabian/Covenant cite title page as-is).
- Series without official enumeration (BECNT, NICNT/OT, NIGTC, ZECNT/OT, SGBC, EGGNT, NIBC) leave `volume_number` null.
- Publisher string rewrites deferred except obvious typos; series imprint changes handled carefully in later batches.
- Calvin skipped for volume mapping; consistency-within-series + multi-vol reprint / standalone / merge review lists deferred to end of pass.

## Schema changes

- DML only — `20260722220157_library_commentary_consistency_batch1.sql` (no typegen).

## New components / patterns added

- None.

## Open questions surfaced

- Batch 2+ candidates: Guthrie 2 Cor → BECNT; CSC/BST/ACCS series creates; WBC Arnold Colossians rev. volume; TOTC numbering; EGGNT/ZECNT metadata mess; Jobes POD publisher.

## Surprises

- Fitzmyer trailing period lived on `people.last_name`, not free-text author_display.
- Bright dup was near-identical (same page count, coverage, year) — keep richer subtitle row.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — n/a
- [ ] AGENTS.md — n/a
- [ ] tracker — n/a
