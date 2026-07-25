# 171 — Hermeneia cite full name in footnotes

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (follow-up to [170](170-hermeneia-bultmann-johannine.md))

## Built
- Migration `20260725002500_library_hermeneia_abbr_full.sql` (applied hosted): `series.abbreviation` `Herm` → `Hermeneia` for the Hermeneia row

## Decided
- Footnotes use `series.abbreviation` when set (`formatSeriesSegment` note mode) — [170] wrongly assumed `Herm` was UI-only and citations would use `series.name`
- Hermeneia / Covenant style cites the **full word**, not an acronym; set abbr = name so notes and bib both emit `Hermeneia`
- No formatter change — WBC/NAC/AB still correctly prefer abbr in notes

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Series abbr is the footnote series label whenever non-null; for series that intentionally avoid acronyms, abbr must equal the cite form (full name), not a catalog shorthand

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A
