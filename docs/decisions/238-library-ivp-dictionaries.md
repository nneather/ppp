# 238 — IVP Bible dictionaries

**Date:** 2026-10-07
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261007234000_library_ivp_dictionaries.sql` (hosted push). All on the existing **IVP Bible Dictionary Series**. Publisher IVP, Downers Grove, IL. Biblical Reference, `edited_volume`, reading status reference. No bible coverage.
  - **DJG** *Dictionary of Jesus and the Gospels* — corrected the existing row to the 1992 first edition `9780830817771`, edition First. Editors stay Joel B. Green, Scot McKnight, I. Howard Marshall.
  - **DJG2** — 2013 second edition `9780830824564`, edition Second. Editors Joel B. Green, Jeannine K. Brown, Nicholas Perrin.
  - **DNTB** — Craig A. Evans and Stanley E. Porter, 2000, `9780830817801`.
  - **DOTP** — T. Desmond Alexander and David W. Baker, 2002, `9780830817818`.
  - **DLNT** — Ralph P. Martin and Peter H. Davids, 1997, `9780830817795`.
  - **DOTPr** — Mark J. Boda and J. Gordon McConville, 2012, `9780830817849`.
- New people: Stanley E. Porter, Jeannine K. Brown, Nicholas Perrin, David W. Baker, J. Gordon McConville.

## Decided

- Same split as DPL / DPL2 ([229](229-library-sep16-shelf-batch.md)): 1st edition keeps the historical abbreviation (`DJG`), 2nd edition is `DJG2`. Natural key is ISBN, because both rows share the title and the series.
- The existing DJG row had the 2013 ISBN and year with the 1992 editors. Parker confirmed that shelf copy is the first edition, and he now also has the second. Corrected the ISBN and year rather than inserting a duplicate 1st.
- Current SBL abbreviations: **DLNT** (not the older DLNTD) and **DOTPr**. DNTB and DOTP are unchanged.
- `edited_volume` and reading status `reference`, matching the DPL pair. DOTHB stays the `reference_work` exception because it has seeded essays.

## Schema changes

- `20261007234000_library_ivp_dictionaries.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- The pre-existing DJG row was a hybrid: 2nd-edition ISBN `9780830824564` and year 2013, 1st-edition editors, citation abbr `DJG`.
- `author_display` abbreviates a spelled-out middle: Alexander shows as `T. D. Alexander`, McConville as `J. G. McConville`. Person rows still store Desmond and Gordon.
- Jeannine K. Brown is a new person. Francis Brown, Raymond E. Brown, Kelly J. Brown, and A. Philip Brown II were already there.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] No Commentaries in this batch
