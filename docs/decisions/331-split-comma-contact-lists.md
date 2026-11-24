# 331 — Split comma contact lists

**Date:** 2026-11-24
**Module:** contacts
**Tracker session:** data fix (closes the group-column note in [210](210-contacts-semester-period-cadence.md))

## Built

- Hosted data only. Five standing lists whose names were the Sheet1 group cell as written (`229, STL`, `STL, Timothy`, `Timothy, 229`, `Timothy, STL`, `STL, 229, Timothy`) are soft-deleted.
- Their 11 households are on each named list: 229, STL, and Timothy. Jimmy and Haley Thomas are on all three. The other ten are on the two lists in their old name.
- 23 new `contact_list_members` rows (household membership, same `created_by` as the import). The combined-list memberships are soft-deleted with the lists.

## Decided

- A comma in an imported group name means membership in each existing list, not a list of its own. The three-name cell is three lists.
- Soft-delete, not a hard delete, so the audit trigger keeps the change.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- The Sheet1 importer still stores the group cell as one list name. A re-import would recreate these combined lists.

## Surprises (read these before the next session)

- None of these households were already on 229, STL, or Timothy, so every split was a new membership.

## Carry-forward updates

- [x] components.mdc updated — no component change
- [x] AGENTS.md inventory updated — no helper change
- [x] new env vars documented — none
- [x] tracker Open Questions updated — session arc note
