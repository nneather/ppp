# 233 — ConC Proverbs (Steinmann)

**Date:** 2026-09-26
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20260926214500_library_conc_proverbs_steinmann.sql` (hosted push):
  - **ConC** *Proverbs* — Andrew E. Steinmann, Concordia Pub. House, Saint Louis, 2009 `9780758603203`.
  - New person: Andrew / E. / Steinmann.
  - Coverage: Proverbs. `needs_review = false`. `reading_status = reference`.

## Decided

- Year is the copyright **2009** (WorldCat, Logos, Best Commentaries 1 Nov 2009). CPH’s product page lists Publication Date 2010; Parker confirmed 2009.
- Attach existing **ConC**. No `volume_number` (Lockwood and Bollhagen leave it empty).
- Publisher string matches the other Concordia rows: `Concordia Pub. House` / `Saint Louis`.

## Schema changes

- `20260926214500_library_conc_proverbs_steinmann.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- CPH’s marketing blurb misspells the surname “Steinman”. Catalogs and the author line are **Steinmann**.

## Carry-forward updates

- [x] Decision + PLAN.md
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none
