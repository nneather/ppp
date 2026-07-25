# 180 — Contacts Session 2 (dashboard due + MCP)

**Date:** 2026-07-24
**Module:** contacts / CRM
**Tracker session:** Session 2

## Built

- Dashboard **Due to meet** card under Now (desktop) + mobile Contacts glance tile — active, `!no_reminders`, never touched or last touch older than effective cadence.
- `loadContactsDue` / `selectContactsDue` + pure helpers in `src/lib/contacts/due.ts`.
- MCP: `list_contacts_due` real (same stub name) + new `search_contacts`; `npm run mcp:smoke` green (12 tools).
- **C2 locked:** Christmas card / list roster excludes households with no live *active* members; membership rows stay in DB (un-retire restores without re-add). Settings lists show a hidden-count note.

## Decided

- **C2** — effective card-list queries hide retired-only (and empty) households; do not auto soft-delete memberships.
- Dashboard placement mirrors classwork Session 2 (D1=B): distinct card under Now, not MYN task rows; mobile = count glance tile.
- Never-touched sorts first; `days_overdue` is `null` when never logged (UI: “Never logged”).
- No schema / view for C2 — app-side filter in `loadContactListMembers`.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/dashboard-contacts-due.svelte`](../../src/lib/components/dashboard-contacts-due.svelte) — desktop due-to-meet panel.
- [`src/lib/contacts/due.ts`](../../src/lib/contacts/due.ts) — cadence due + C2 eligibility helpers.

## Open questions surfaced

- Owner smoke checklist parked in [POS_Contacts_Build_Tracker.md](../POS_Contacts_Build_Tracker.md) › Owner smoke (Sessions 1–2) + PLAN session prompt — UI/MCP client verification when Parker has time.
- None blocking product. Mailing-list send remains backlog.
- Weekly R2 backup dump still does not include contacts tables (ops follow-up from [178](178-contacts-session-1.md)).

## Surprises (read these before the next session)

- Hosted contacts corpus empty during smoke (`list_contacts_due` / `search_contacts` count 0) — loaders + MCP paths still exercised.
- Dashboard load adds one contacts-due round-trip after the existing parallel batch (needs profile cadence from the same profiles row already selected).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] tracker Session 2 done; C2 resolved
- [x] PLAN.md refreshed (Session 2 prompt deleted)
- [ ] new env vars — none
