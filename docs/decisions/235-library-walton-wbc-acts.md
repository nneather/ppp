# 235 — Walton WBC Acts 1-9:42

**Date:** 2026-09-27
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20260927184700_library_walton_wbc_acts.sql` (hosted push):
  - *Acts 1-9:42* — Steve Walton. WBC **37A**. Zondervan Academic, Grand Rapids, MI, 2024. ISBN `9780310599388`.
  - Genre Commentary. `reading_status` reference. `needs_review` false. Coverage: Acts.
  - New person: Steve Walton. Did not reuse John H. Walton.

## Decided

- Title is the publisher form *Acts 1-9:42* (volume stays in `volume_number`), matching sibling hyphen titles such as *Hebrews 1-8*.
- Series editors on the Zondervan page (Nancy L. deClaisse-Walford, David Capes) are not authors. Sibling WBC rows credit the volume author only.
- Attach existing `WBC`. Link `publisher_id` to Zondervan Academic.

## Schema changes

- `20260927184700_library_walton_wbc_acts.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- None. No prior WBC Acts row. ISBN checksum on `9780310599388` passed.

## Carry-forward updates

- [x] Decision + PLAN.md
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars — none
