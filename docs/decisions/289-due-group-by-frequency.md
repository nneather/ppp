# 289 — Due lists group by frequency

**Date:** 2026-10-21
**Module:** contacts
**Tracker session:** ad-hoc

## Built

- Due this period on `/contacts`, and Due to meet on the home page, list people under Quarterly, then Semester, then Annual.
- Inside a group, the previous order stays: never met, then oldest last meet.
- The frequency label moved to the group heading. Each heading shows how many are in that group.

## Decided

- The contacts strip now loads the full due set (cap 500; it was 100, which hid the most recently met). The home panel still shows 25.
- Leave `selectContactsDue` and MCP `list_contacts_due` on oldest-meet order. Grouping is display-only.

## Schema changes

- None.

## New components / patterns added

- `groupContactsDueByFrequency` in `src/lib/contacts/due.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- A household collapses to one frequency, the representative row’s. Mixed-frequency households still land in one group.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented
- [x] tracker Open Questions updated
