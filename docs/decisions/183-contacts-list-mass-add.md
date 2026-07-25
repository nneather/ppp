# 183 — Contacts list mass-add (bootstrap + sheet toggles)

**Date:** 2026-07-25
**Module:** contacts / CRM
**Tracker session:** Ad-hoc polish after Session 3

## Built

- Lists tab: searchable multi-select checklist (`contact-list-add-panel`) — household-first; filters Not on list / Has address / All; batch `addContactListMembersBatch`; “Add contacts instead…” disclosure.
- Household + contact Sheets: **Lists** checkboxes (`contact-list-toggles`); create/update syncs membership via `syncEntityListMemberships` (`member_list_id` FormData).
- Loaders: `loadListMembershipMaps`, `loadHouseholdListCandidates`; pure filters in `list-candidates.ts`.

## Decided

- **Two surfaces** — Lists checklist for bootstrap/catch-up; Sheet toggles for ongoing (option 2 from product discussion). No separate new-list wizard.
- **No schema change** — reuse `contact_list_members` add/revive + soft-delete.
- **Christmas cards** — mass-add defaults to households; contact path de-emphasized but available.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/contacts/list-candidates.ts`](../../src/lib/contacts/list-candidates.ts) — candidate filter helpers.
- [`src/lib/components/contact-list-add-panel.svelte`](../../src/lib/components/contact-list-add-panel.svelte) — Lists-tab mass-add.
- [`src/lib/components/contact-list-toggles.svelte`](../../src/lib/components/contact-list-toggles.svelte) — Sheet list checkboxes.

## Open questions surfaced

- Owner MCP smoke still open from Session 2.
- Optional later: after **New list**, auto-navigate to that list’s checklist.

## Surprises (read these before the next session)

- Sheet sync field is `member_list_id` (not `list_id`) so it does not collide with batch add’s target `list_id`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [x] tracker note
- [ ] new env vars — none
