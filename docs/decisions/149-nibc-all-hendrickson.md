# 149 — All NIBC vols → Hendrickson

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — follow-up to [148](148-paternoster-nibc-nigtc-remint.md)

## Built

- Idempotent DML `20260724213500_library_nibc_all_hendrickson.sql` (hosted `db push`):
  - Every live book in series `NIBC` → **Hendrickson** / `Peabody, MA`
  - Reminted remaining **Baker Books** ×5 + **Harper & Row** ×1 + **HarperCollins** ×1 (Paternoster fours already done in [148](148-paternoster-nibc-nigtc-remint.md))
- Post-apply: **25** NIBC vols, all Hendrickson / Peabody

## Decided

- Series membership is decisive for NIBC imprint: cite as Hendrickson even when OL/Goodreads/spine-era free-text said Baker, Harper, or Paternoster (owner confirmation; overrides the “leave Baker NIBC reprints” hedge in [133](133-baker-publisher-link-pass.md)).

## Schema changes

- `20260724213500_library_nibc_all_hendrickson.sql` — DML only

## Open questions surfaced

- None for NIBC. Remaining unlinked Paternoster monographs (*Paul*, *From Paradise…*) unchanged.

## Surprises

- First draft of the UPDATE used `FROM publishers h JOIN series s ON s.id = b.series_id` — Postgres rejects referencing the UPDATE target in that JOIN; rewritten to comma-FROM + `WHERE s.id = b.series_id`.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — N/A (DML-only)
