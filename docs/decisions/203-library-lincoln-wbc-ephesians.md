# 203 — Library Lincoln WBC Ephesians

**Date:** 2026-08-18
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260818143000_library_lincoln_wbc_ephesians.sql` (hosted push):
  - **New person:** Andrew T. Lincoln (`middle_name` `T`).
  - **Insert:** *Ephesians*, WBC vol 42, Word / Waco, TX, 1990, ISBN `9780849902413`.
  - Linked existing **Word** publisher row + **WBC** series.
  - **Coverage verified:** `{Ephesians}`.

## Decided
- Imprint matches Word-era WBC siblings (`Word` + `Waco, TX`), not the 1990 title-page *Word Books, Dallas*.
- 1990 Word hardcover ISBN (not Zondervan reprint `9780310521686`).
- `needs_review = false`.

## Schema changes
- `20260818143000_library_lincoln_wbc_ephesians.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- 1990 catalogs list Dallas / Word Books; this library’s Word-era WBC rows are uniformly Waco. Owner picked sibling match.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
