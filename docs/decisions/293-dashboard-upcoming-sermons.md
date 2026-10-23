# 293 — Dashboard upcoming sermons

**Date:** 2026-10-23
**Module:** sermons
**Tracker session:** ad-hoc

## Built

- Dashboard upcoming-sermons panel shows the next three sermons (`preached_on >=` today, soonest first).
- The header (“Upcoming sermons” and “All sermons”) opens `/studies/sermons`. Each row opens `/studies/sermons/[id]`.

## Decided

- Cap is the dashboard load only (`limit: 3`). Studies overview and `list_upcoming_sermons` stay at 5.

## Schema changes

- None.

## New components / patterns added

- None. `<DashboardUpcomingSermons>` link targets changed.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- A fourth sermon (2026-12-20, Grandcote) exists past the cap, so the limit is doing work.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker — ad-hoc, no session row
