# 199 — Library Charles ICC Revelation (2 vol)

**Date:** 2026-08-13
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260813131000_library_charles_icc_revelation.sql` (hosted push):
  - **New person:** Robert H. Charles.
  - **2 ICC inserts:** `Revelation 1–14` + `Revelation 15–22` (T&T Clark, Edinburgh, 1920; ISBN null).
  - **Coverage verified:** `Revelation` on both volumes.

## Decided
- ISBN **null** — 1920 originals (same pattern as Bigg ICC 1902), not modern reprint barcodes.
- Split titles with chapter ranges (KCC Psalms pattern), not formal volume numbers.
- Author stored as **Robert H. Charles** (full first name, like Charles Bigg).

## Schema changes
- `20260813131000_library_charles_icc_revelation.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- None

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
