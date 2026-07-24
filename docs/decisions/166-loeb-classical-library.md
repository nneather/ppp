# 166 — Loeb Classical Library series + remint four editions

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — shelf catalog (August QA Track B)

## Built
- Migration `20260724240000_library_loeb_classical_library.sql` (applied hosted):
  - Series **Loeb Classical Library** (`LCL`), `include_in_citation=false`
  - Reminted four existing rows that already were the Loebs (wrong publisher/title metadata):
    - Confessions I–II → Loeb titles + vols **26** / **27**; Harvard / Cambridge, MA; genre **Church Fathers**
    - *The Teacher. Teaching Christianity* (was New City Press) → LCL **560**, 2025, ISBN `9780674997721`; **Church Fathers**
    - Boethius *Theological Tractates. The Consolation of Philosophy* (was Digireads) → LCL **74**, 1973, ISBN `9780674990838`; Philosophy kept

## Decided
- LCL omitted from Turabian series segment (owner: not displayed on citation) — same pattern as SSBT / TDNT / LSJ
- Augustine Loebs retagged **Church Fathers** (primary-text bucket); Boethius stays **Philosophy**
- No new INSERTs — New City / Digireads labels were catalog errors on the Loeb copies

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Confessions already had correct Loeb ISBNs/years but publisher string embedded “(Loeb Classical Library)” with null `series_id`
- “New City” Teacher and “Digireads” Boethius were the Loeb volumes, not separate editions

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A (DML only)
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
