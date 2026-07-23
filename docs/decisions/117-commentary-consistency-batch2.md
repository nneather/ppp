# 117 — Commentary consistency Batch 2

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — commentary metadata uniformity pass (cont.)

## Built

- Migration `20260722220731_library_commentary_consistency_batch2.sql`:
  - New series: **CSC**, **BST**, **NIVAC**, **CBC**.
  - Series attaches: Guthrie 2 Cor → BECNT; Garland 2 Cor → CSC (cleared subtitle); Stott Romans + Firth Esther → BST; Jobes Esther → NIVAC; Boda Chronicles → CBC; Beale Revelation + Harris 2 Cor → NIGTC; Bray 1–2 Cor + Oden/Hall Mark → ACCS.
  - Beale title → `The Book of Revelation`.
  - TOTC vols 3/4/6; TNTC vols 4/7.
  - Arnold ZECNT Ephesians + Longman SGBC Genesis imprint/ISBN/year corrections; NIBC Philippians publisher typo; people **Milgron → Milgrom**.

## Decided

- Owner confirmed Batch 2 + capitalize Beale “Book”; continue into Batch 3+.

## Schema changes

- DML only — no typegen.

## Open questions surfaced

- Sarna JPSTC *Genesis* (Schocken 1966) is likely *Understanding Genesis*, not JPS Torah — Batch 3 candidate to detach.
- Spurgeon *Treasury of David* ×3 under `SS` (Sermons) — series/merge review.
- EGGNT metadata mess still deferred.

## Carry-forward updates

- [x] PLAN.md refreshed
