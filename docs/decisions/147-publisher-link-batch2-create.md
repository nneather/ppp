# 147 — Publisher link batch 2 (create + link)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — pair with [146](146-publisher-link-batch1-registry.md)

## Built

- Idempotent DML migration `20260724212100_library_publisher_link_batch2_create.sql` (hosted `db push`):
  - Created + linked: **Banner of Truth** (13, Carlisle, PA), **Moody Publishers** (10, Chicago, IL), **Word** (12, Waco, TX), **Reformation Heritage Books** (7, Grand Rapids, MI), **Brill** (7, Leiden), **Thomas Nelson** (6, Nashville, TN)
  - Aliases cover Trust / Press / E. J. Brill / Word Books variants
- **WBC imprint split preserved:** Word ×10, Thomas Nelson ×2, Zondervan Academic ×2 — no cross-fold

## Decided

- Keep **Word** as its own registry row — do **not** merge into Thomas Nelson. WBC spine imprint stays Word-era vs Nelson-era vs Zondervan-era.
- **Banner of Truth Trust** → canonical `Banner of Truth` / Carlisle, PA (US distribution office).
- **Moody Press** historical → `Moody Publishers`.
- **Brill** / `E. J. Brill` → single `Brill` / Leiden; exclude Brilliance Audio.
- Skip **Paternoster** this pass (inventory noted below for later).
- Skip creating **Apollos** — see Open questions.

## Schema changes

- `20260724212100_library_publisher_link_batch2_create.sql` — DML only (INSERT publishers + book links)

## Open questions surfaced

- **Paternoster (7, skipped):** Bruce *Paul*; NIBC John / Philippians / Matthew / Galatians; Alexander *From Paradise…*; Thiselton *1 Cor* NIGTC. Several ISBNs look Hendrickson/Harper co-publishes — shelf before linking.
- **Apollos:** do **not** create a publisher. ApOTC *1 & 2 Kings* already **IVP Academic**; *1 & 2 Samuel* still free-text `Inter-Varsity Missions` (fix separately). Two monographs free-text `Apollos` have non-Apollos ISBNs (Plantinga `08028*` → Eerdmans; Long `0310*` → Zondervan) — remint by ISBN, don’t invent Apollos.

## Surprises

- WBC already mixed three imprints correctly once Word vs Nelson were separate rows.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — N/A (DML-only)
