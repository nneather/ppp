# 112 — Task sheet date field overflow

**Date:** 2026-07-22
**Module:** projects
**Tracker session:** ad-hoc — owner smoke of recurring tasks ([109](109-tasks-active-badge-recurrence.md))

## Built

- Stop horizontal scroll in `<ProjectTaskSheet>`: `overflow-x-hidden` + `min-w-0` on sheet/form/scroll body.
- Date fields: CSS **grid** wrapper (`grid-cols-1`) constrains WebKit intrinsic width **without** clipping the right border (overflow-hidden made the control look open-ended).
- Sticky footer: `pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))]` so Add/Cancel sit above the iOS home indicator.
- `<Input>`: `max-w-full` on all inputs; `display:block` for WebKit date/time types.

## Decided

- Prefer grid containment over `overflow-hidden` for date inputs — keeps a full rounded border matching Title/Project/Zone.
- Fix at shared Input + sheet shell (not a custom date picker) — same Safari intrinsic-width issue can hit other sheets.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Projects E2E smoke otherwise passed; only Start date overhang caused sideways scroll.
- First containment pass used `overflow-hidden` and clipped the date’s right border — looked “open-ended”; switched to grid.

## Carry-forward updates

- [x] PLAN.md — Recent / Next up / module rows / Done recently refreshed (2026-07-22)
- [ ] components.mdc — N/A
