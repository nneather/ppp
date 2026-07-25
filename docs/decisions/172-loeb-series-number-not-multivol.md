# 172 — Loeb series number ≠ multi-vol; translator `et al.` period

**Date:** 2026-07-24
**Module:** library
**Tracker session:** Wave 2 August shelf QA Track B (row 8 / Loeb Teacher; Bultmann Hermeneia)

## Built

- Dispatch + volume helpers: `volume_number` with a series and no `total_volumes > 1` is **series enumeration** (Loeb 560), not a multi-volume work — footnotes use page alone (not `560:[page]`); bib omits `Vol. 560.`
- `formatTranslatorsBibliography` / `formatEditorsCreditBibliography`: no double period after `et al.`

## Decided

- Loeb catalog numbers stay in `books.volume_number` for shelf identity; they must not drive Turabian `vol:page` / `Vol. N.` when LCL (or any series) is attached and the row is not a multi-vol set.

## Schema changes

- None.

## Open questions surfaced

- None.

## Surprises

- LCL already had `include_in_citation=false` ([166](166-loeb-classical-library.md)); the bug was multi-volume dispatch, not the series segment.

## Carry-forward updates

- [x] unit tests (Loeb + `et al.`)
- [ ] PLAN.md / AGENTS — with next Track B closeout
