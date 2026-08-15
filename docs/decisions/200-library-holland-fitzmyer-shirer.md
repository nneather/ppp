# 200 — Library Holland / Fitzmyer / Shirer shelf add

**Date:** 2026-08-15
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260815155421_library_holland_fitzmyer_shirer.sql` (hosted push):
  - **New person:** Tom Holland.
  - **3 inserts:** *Dominion* (Basic Books 2021 paperback, `original_year` 2019); AB *First Corinthians* (Yale 2008, vol 32); *The Collapse of the Third Republic* (Simon & Schuster 1969).
  - Reused Joseph A. Fitzmyer (`middle_name` `A`) and William L. Shirer (`L.`).
  - **Coverage verified:** `1 Corinthians` on Fitzmyer.

## Decided
- Dominion: **2021 paperback** `9781541675599` (not 2019 hardcover); genre **History**; title/subtitle split; `original_year` 2019.
- Fitzmyer title **First Corinthians** (Yale/AB catalog), series `AB` vol 32, Yale not Doubleday.
- All three `needs_review = false`.

## Schema changes
- `20260815155421_library_holland_fitzmyer_shirer.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Fitzmyer AB 1 Corinthians is a 2008 **Yale** replacement of the older Orr/Walther Doubleday vol 32 — never a Doubleday Fitzmyer printing.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
