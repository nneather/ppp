# 298 — Dashboard phone order

**Date:** 2026-10-23
**Module:** projects
**Tracker session:** ad-hoc

## Built

- Phone `/dashboard` (below `md`) stacks: Project status, Tasks, Library, Upcoming sermons, Contacts, Classwork, Sports, then Invoicing.
- A missing-check-in banner still sits directly under Project status.
- Desktop stays a two-column home: status, Invoicing beside Library, sermons, and sports on the left; Due soon and Due to meet on the right. Phone glance tiles stay off that column.

## Decided

- Invoicing stays on the phone, after Sports, so the requested sequence is uninterrupted.
- One copy of each block. Desktop placement uses grid `order` from `md` up, so the Generate shortcut is mounted once.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- The old module grid was `lg:grid-cols-3` with only Invoicing and Library visible, so those cards sat in a blank third cell. Desktop is now two equal columns.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker — ad-hoc, no session row
