# 104 — SBL series abbreviation cleanup

**Date:** 2026-07-21
**Module:** library
**Tracker session:** Ad-hoc — follow-up to Nelson/SBL abbreviation review after [102](102-august-qa-covenant-fixtures.md)

## Built

- Migration `20260721220000_library_sbl_series_abbr_cleanup.sql` (applied hosted):
  - **Apollos** `AOTC` → **`ApOTC`** (SBL: `AOTC` = Abingdon OT Commentaries)
  - **Keil & Delitzsch** (10 vols) off **Continental Commentary** (`COT`) onto new **`K&D`**
  - **Matthew Henry** (6 vols) off **Moffatt NT Commentary** onto new **`MHC`**; Moffatt abbr → **`MNTC`**
- Seed + `migrationOverrides.ts` aligned so re-import won't recreate the collisions.
- Biblical fixture periods dropped earlier in-session (`Gen 1:1`) — SBL-style, no trailing period.

## Decided

- Prefer SBLHS commentary abbreviations when they conflict with Pass-1 improvised codes.
- Keep empty **Continental Commentary** (`COT`) and **Moffatt** (`MNTC`) rows for future real volumes.

## Schema changes

- `20260721220000_library_sbl_series_abbr_cleanup.sql` — data-only series insert/update + book `series_id` reassignment (no typegen).

## New components / patterns added

- None.

## Open questions surfaced

- None blocking. Optional later: audit other non-SBL homemade abbrs (`CONC`, `CCL`, bare `IVP`, etc.) against §8.4 when citing.

## Surprises (read these before the next session)

- Pass-1 mapped K&D → Continental and Henry → Moffatt because source CSV series codes were overloaded (`COT` / `MH`), not because the physical sets belong there.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none
