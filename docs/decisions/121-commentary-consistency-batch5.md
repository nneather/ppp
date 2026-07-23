# 121 — Commentary consistency Batch 5 (A/B/C closeout)

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — commentary metadata uniformity pass (end lists)

## Built

- Migration `20260723150823_library_commentary_consistency_batch5.sql`:
  - **Calvin CC:** mapped all 22 rows to Trinity/Baker set volumes ([list](https://www.trinitybookservice.com/calvins-commentaries-22-volume-set/)); vols 2–3 remain Exodus harmony parts 1–2. Titles unchanged.
  - **Shelf-flagged (August STL):** Banner Genesis / Eerdmans Psalms 93–150 / CTS 1845 Harmony (non-Baker CC imprints); EHS MacLaren ×2; NIB *Acts–1 Corinthians* (missing pub/year/ISBN); WBC Arnold *Colossians* (2025); Berit Olam Walsh + Schaefer; Spurgeon *Treasury* ×3 (vols/imprint).
  - **Spurgeon:** detached from `SS`; left without series (no new Treasury series).
  - **EGGNT:** Williams *Mark*, Merkle *Ephesians*, Quarles *Matthew*, Harris *John* → `B&H Academic` with print ISBNs/years.
  - **Wright *Deuteronomy*:** soft-deleted UBCS row; kept NIBC.

## Decided

- Calvin enumeration follows the Baker 22-vol Trinity Book Service spine list; content titles stay as recorded (no title-page rewrite).
- Spurgeon stays **series-less** rather than a dedicated Treasury series (can revisit later).
- List C standalones (Luther, Hodge, Barth, Collins, Pink×2, Boice, Stewart, Polich-Short, Bruce John×2, Alexander, Guelich) **confirmed standalone** — no series attaches.
- Berit Olam stays `volume_number` null; shelf only.

## Schema changes

- DML only — no typegen.

## Open questions surfaced

- August shelf: assign Spurgeon vols 1–3 + pick MacDonald vs Hendrickson; confirm Calvin non-Baker imprints against the Baker set actually on the shelf; NIB Abingdon spine; Arnold WBC vol #.

## Carry-forward updates

- [x] PLAN.md refreshed
