# 148 — Paternoster NIBC → Hendrickson; NIGTC 1 Cor → Eerdmans

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — follow-up to [147](147-publisher-link-batch2-create.md) open questions

## Built

- Idempotent DML `20260724213000_library_paternoster_nibc_nigtc_remint.sql` (hosted `db push`):
  - NIBC *Galatians*, *John*, *Matthew*, *Philippians* (were `Paternoster Press`) → **Hendrickson** / `Peabody, MA`
  - Thiselton *The First Epistle to the Corinthians* NIGTC → **Eerdmans** / `Grand Rapids, MI`
- Left *Paul Apostle of the Heart Set Free* + Alexander *From Paradise…* as unlinked Paternoster for later

## Decided

- Owner-confirmed: those four NIBCs are Hendrickson; Thiselton NIGTC 1 Cor is Eerdmans (not Paternoster).

## Schema changes

- `20260724213000_library_paternoster_nibc_nigtc_remint.sql` — DML only

## Open questions surfaced

- Other NIBCs still on **Baker Books** (×6) or unlinked Harper / HarperCollins (×2) — not touched; may be real reprints vs free-text drift.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — N/A (DML-only)
