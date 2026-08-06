# 196 — Invoicing historical FOL + TWH hours import

**Date:** 2026-08-05
**Module:** invoicing
**Tracker session:** ad-hoc — historical hours from NPN Hours spreadsheet

## Built
- Migration `20260806031936_invoicing_historical_fol_twh_hours.sql` (hosted push):
  - **FOL** (`Fountain of Life Church`, soft-deleted): 105 time entries, 69.00h @ $35 = **$2,415.00** (2025-06-23 → 2026-08-05).
  - **TWH / 229 Project**: 330 time entries, 392.50h @ $100 = **$39,250.00** (2025-09-02 → 2026-04-11).
  - One **paid** stub invoice per client (via `generate_invoice_number()`) + single summary line item so entries are not unbilled; full period breakdown deferred.
- Source CSVs: `NPN Hours - FOL Hours`, `NPN Hours - TWH Hours` (MM-DD dates; year wrap inferred).

## Decided
- Import **both** payers; FOL stays soft-deleted (completed).
- All imported hours treated as **already paid** (linked to stub invoices).
- **Entries-first** — no monthly/weekly invoice reconstruction yet. Planned shape later: FOL monthly through Nov 2025, then one lump Dec 2025–Aug 2026; 229 weekly.
- Drop three TWH trailing rows that were FOL paste (2026-05-27 Form Build / Meeting, 2026-06-02 Follow ups).
- Blank TWH descriptions → `"Meetings and Development"`.
- TWH import **stops before 2026-04-13** (first native 229 entry already in ppp).

## Schema changes
- `20260806031936_invoicing_historical_fol_twh_hours.sql` — DML only (idempotent on fixed stub invoice UUIDs)

## New components / patterns added
- None

## Open questions surfaced
- Reconstruct FOL monthly + lump / 229 weekly invoices from these entries when ready for invoice-level history UI.

## Surprises (read these before the next session)
- 229 already had 216 native entries (305h) from 2026-04-13 onward — spreadsheet and ppp abut cleanly at 2026-04-11 / 2026-04-13.
- Spreadsheet period $ markers do not always match month sums; import trusts row hours × rate.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a (optional note on invoice reconstruction later)
