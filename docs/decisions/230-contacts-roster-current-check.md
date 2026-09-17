# 230 — Contacts roster current check

**Date:** 2026-09-17
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [223](223-contacts-roster-search-density.md)

## Built

- `/contacts` Contacts tab: emerald `CircleCheck` after the name when that person is **up to date** for the current meet period.
- `isContactCurrentForPeriod` in `due.ts` (unit-tested). `ContactListRow.period_current` is set in `loadContacts` from last meet + live period skips.

## Decided

- **Check = active Quarterly / Semester / Annual whose current period is already met or skipped.** Same rule as “not due” for scheduled people ([210](210-contacts-semester-period-cadence.md)/[212](212-contacts-due-integrity.md)).
- **No check** for Common, None, retired, or still-due people. Unscheduled contacts have no period obligation; a check on them would dilute the scan.
- Households tab and dashboard due tile unchanged. Due strip stays the work queue; the roster check is the A–Z glance.

## Schema changes

- None.

## New components / patterns added

- `isContactCurrentForPeriod` in [`src/lib/contacts/due.ts`](../../src/lib/contacts/due.ts). Page-local icon on `/contacts` (no new component).

## Open questions surfaced

- None. If Common/None should also show a “no action” mark, that is a separate scan choice.

## Surprises (read these before the next session)

- Due rows are household-collapsed, so the roster cannot reuse `dueContacts` as a per-person current set. Skips had to load on the roster path too.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — `isContactCurrentForPeriod`
- [ ] new env vars — none
- [x] tracker session row
