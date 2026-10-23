# 296 — Due frequency nudge

**Date:** 2026-10-23
**Module:** contacts
**Tracker session:** ad-hoc

## Built

- On `/contacts`, each row in **Due this period** has up and down buttons to the left of Log.
- Up moves one step toward meeting more often (Annual → Semester → Quarterly). Down moves the other way.
- Quarterly shows only down. Annual shows only up. Semester shows both.

## Decided

- The step stays inside Quarterly / Semester / Annual. Common and None are not reachable from this row.
- A household row updates every active scheduled member who is still on that row’s frequency. A spouse on a different frequency stays put.
- The home **Due to meet** panel is unchanged.

## Schema changes

- None.

## New components / patterns added

- `stepScheduledFrequency` and `frequencyNudgeContactIds` in `src/lib/contacts/due.ts`.
- `nudgeContactFrequencyAction` (`?/nudgeContactFrequency`).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- A collapsed household still has one displayed frequency (the representative). The nudge writes only members on that frequency, so a mixed household can stay mixed.

## Carry-forward updates

- [x] components.mdc updated — no new component; buttons stay on the contacts page
- [x] AGENTS.md inventory updated
- [x] new env vars documented
- [x] tracker Open Questions updated
