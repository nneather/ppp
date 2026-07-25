# 168 — Cost of Discipleship Scribner 1995 remint

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (shelf edition remint)

## Built
- Migration `20260725000642_library_cost_of_discipleship_scribner_1995.sql` (applied hosted):
  - Keeper `1a886166-…` → Scribner / New York / 1995 / ISBN `9780684815008` / 320 pp / `original_year=1937` / `copy_count=2`
  - Soft-deleted import twin `94a952ff-…` (same old Scribner Paper Fiction / 1961 metadata)

## Decided
- Consolidate two identical owned rows into one shelf record with **`copy_count=2`** (not two live book rows)
- Publisher label **Scribner** (not Simon & Schuster / Scribner Paper Fiction)
- `original_year=1937` = German *Nachfolge* first pub (matches Brunnen remint [167]) — not 1948 first English. In-app Turabian only surfaces `original_year` when `reprint_*` fields are set; alone it is inventory metadata.

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Two near-simultaneous Goodreads import twins (`created_at` 200ms apart) with identical ISBN/year — soft-delete + copy_count is the established multi-copy pattern ([103](103-library-not-owned-session-1.md) / politics batch)

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A (DML only)
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
