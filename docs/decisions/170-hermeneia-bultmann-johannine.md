# 170 — Hermeneia Bultmann Johannine Epistles

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (library-add-books)

## Built
- Migration `20260725002000_library_hermeneia_bultmann_johannine.sql` (applied hosted):
  - Create series **Hermeneia** (`Herm`)
  - Rename person Rudolph → **Rudolf** Bultmann (denorm refresh on both shelf books)
  - Insert *The Johannine Epistles* — Fortress Press / Philadelphia / 1973 / ISBN `9780800660031` / `original_year=1967` / Commentary / reference
  - Credits: Bultmann author; O’Hara + McGaughy + Funk translators; Funk editor
  - Coverage: 1 John, 2 John, 3 John

## Decided
- Series abbr **`Herm`** (Best Commentaries style); citation still uses the full word Hermeneia via series name
- Correct Americanized **Rudolph** → **Rudolf** on the shared person row (not a second person)
- Store full translator + editor credits from the Hermeneia title page (Funk appears twice — translator and editor; PK allows `(book_id, person_id, role)`)
- `original_year=1967` = German 2nd ed. of *Die drei Johannesbriefe* (source of the English translation), not first German ed.

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Robert W. Funk already existed in `people` — reused; only O’Hara and McGaughy were new

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A
