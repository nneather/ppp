# 113 — Commentary series volume omit (Covenant)

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — owner `.docx` smoke found `Vol. 27.` on Achtemeier Interpretation

## Built

- Gated Turabian helpers in [`publication.ts`](../../src/lib/library/turabian/publication.ts) for `commentary-in-series` (via `resolveCitationSourceType`):
  - **Bibliography:** never emit `Vol. N.` from `volume_number`; still emit `N vols.` when `total_volumes > 1`.
  - **Series segment:** series name only — do not append series enumeration.
  - **Notes:** `vol:page` only when `total_volumes > 1` (multi-vol set inside a series); otherwise page alone.
- Tests: Achtemeier Interpretation (no `Vol. 27`); Zimmerli-style keeps `2 vols.` + `1:142`; Keener standalone keeps `Vol. 3.` / `3:1692`.
- Fixture note on row 13 in [`docs/library-turabian-fixtures.md`](../library-turabian-fixtures.md).

## Decided

- Follow Covenant [Books](https://covenantseminary.libguides.com/turabian/books): book-in-a-series ≠ multi-volume `Vol. N.`; series number optional as bare digit — **omit** for commentaries (matches France NICNT / Wenham WBC / Smalley WBC examples).
- Leave Parsons-style bare series numbers for non-commentary series.

## Schema changes

- None (data `volume_number` may still store series enumeration for shelf/UI; formatter ignores it for commentary-in-series bib/notes except multi-vol sets).

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Owner `.docx` smoke passed hanging indent; this was a formatter/content bug, not Word export.

## Carry-forward updates

- [x] PLAN.md refreshed (`.docx` smoke + this fix)
- [x] `npm run test` — format.test.ts 78/78
