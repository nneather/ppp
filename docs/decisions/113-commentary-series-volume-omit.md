# 113 — Commentary series volume omit (Covenant)

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — owner `.docx` smoke found `Vol. 27.` on Achtemeier Interpretation

## Built

- Gated Turabian helpers in [`publication.ts`](../../src/lib/library/turabian/publication.ts) for `commentary-in-series` (via `resolveCitationSourceType`):
  - **Bibliography:** never emit `Vol. N.` from `volume_number`; still emit `N vols.` when `total_volumes > 1`.
  - **Series segment:** append bare series number after the series title (Covenant optional; owner chose include — e.g. `ESV Expository Commentary 3`). Skip append when `total_volumes > 1` (Zimmerli: `volume_number` is the cited vol, not series enumeration).
  - **Notes:** `vol:page` only when `total_volumes > 1` (multi-vol set inside a series); otherwise page alone.
- Tests: Achtemeier Interpretation (`… Preaching 27`, no `Vol. 27`); Duguid ESV Expository Commentary 3; Zimmerli-style keeps `2 vols.` + `1:142` without bare series digit; Keener standalone keeps `Vol. 3.` / `3:1692`.
- Fixture note on row 13 in [`docs/library-turabian-fixtures.md`](../library-turabian-fixtures.md).

## Decided

- Follow Covenant [Books](https://covenantseminary.libguides.com/turabian/books): book-in-a-series ≠ multi-volume `Vol. N.`; series number optional as bare digit after series title — **include** when `volume_number` is set (owner preference over France/Wenham/Smalley omit examples).
- Leave Parsons-style bare series numbers for non-commentary series.

## Schema changes

- None (`volume_number` stores series enumeration for commentary-in-series; formatter uses it as bare digit after series, not `Vol. N.`, except multi-vol sets).

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Owner `.docx` smoke passed hanging indent; this was a formatter/content bug, not Word export.

## Carry-forward updates

- [x] PLAN.md refreshed (`.docx` smoke + this fix)
- [x] `npm run test` — format.test.ts
