# 204 — Library Knoppers AB 1 Chronicles 10–29

**Date:** 2026-08-18
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260818233645_library_knoppers_ab_1_chronicles_10_29.sql` (hosted push):
  - **Reuse:** Gary N. Knoppers (`middle_name` `N.`) + series `AB`.
  - **Insert:** *1 Chronicles 10–29*, AB vol 12A, Doubleday / New York, 2004, ISBN `9780385512886`.
  - **Coverage verified:** `{1 Chronicles}`.
  - Vol 12 sibling *1 Chronicles 1–9* left unchanged.

## Decided
- Doubleday first printing ISBN (not Yale reprint `9780300139532`).
- Publisher location **New York** (CIP), not sibling vol 12 `Garden City, NY`.
- Title house style matches vol 12 (`1 Chronicles 10–29`, Arabic numeral + en-dash).
- `needs_review = false`.

## Schema changes
- `20260818233645_library_knoppers_ab_1_chronicles_10_29.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Vol 12 is already in the catalog (Doubleday `Garden City, NY`); vol 12A CIP is New York. Owner chose CIP over sibling location.
- First `db push` timed out on IPv6 Direct (`db.objtrdmmqlndtfddtzan…`); retry succeeded.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
