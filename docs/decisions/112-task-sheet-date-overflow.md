# 112 — Task sheet date field overflow

**Date:** 2026-07-22
**Module:** projects
**Tracker session:** ad-hoc — owner smoke of recurring tasks ([109](109-tasks-active-badge-recurrence.md))

## Built

- Stop horizontal scroll in `<ProjectTaskSheet>`: `overflow-x-hidden` + `min-w-0` on sheet/form/scroll body; wrap Start date / Ends-on date in `overflow-hidden`.
- `<Input>`: `max-w-full` on all inputs; `display:block` for WebKit date/time types (intrinsic width was wider than Title/Project/Zone).

## Decided

- Fix at shared Input + sheet shell (not a custom date picker) — same Safari intrinsic-width issue can hit other sheets.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Projects E2E smoke otherwise passed; only Start date overhang caused sideways scroll.

## Carry-forward updates

- [x] PLAN.md — note in Recent / Next up if needed
- [ ] components.mdc — N/A
