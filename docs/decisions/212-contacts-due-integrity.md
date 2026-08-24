# 212 — Contacts due integrity + queue hygiene

**Date:** 2026-08-24
**Module:** contacts / CRM
**Tracker session:** Integrity (post [211](211-contacts-module-review.md))

## Built

- Due-row Log and Skip post `household_id` when the row is collapsed; `logContactQuick` / `skipContactPeriod` fan out to every live **active scheduled** member (`dueFanoutContactIds`). Contact-list Log Contact stays single-person (no `household_id`).
- Household **Log all** stamps live **active** members only (retired excluded).
- Annual pre-start fulfillment: a 2026 meet counts toward `a:2027` (`touchFulfillsPeriod`). 2026 Skip still writes `period_key=a:2027`.
- Pace strip: remaining vs scheduled pool from the **uncapped** collapsed due set; dropped ahead/behind and the mixed Q/S/A days-left clock.
- Closed-period history uses `periodFromKey` so `q:2026-Q4` scores Jul–Dec, not civil Oct–Dec.
- MCP `list_contacts_due` description + payload are period-shaped (`frequency`, `period_key`, `period_end`, `days_left`, `household_id`). Dropped stub `effective_cadence_days`.
- Weekly R2 dump adds `ppp-contacts-YYYY-MM.dump` (households, contacts, touches, lists, members, skips, children, grade_changes).
- Sheet re-import attaches a missing spouse to the existing `household_id` instead of minting a second household.

## Decided

- Due-row fan-out is opt-in via posted `household_id` so the Contacts-tab one-tap Log stays per-person.
- Skip on a household due row fans out even when spouses have different frequencies (each skips their own active period).
- Mixed Q/S/A cannot share one pace clock — remaining/total only ([211] lock). Quarterly past-period details stay, scored with on-ramp windows.
- Christmas Has-address seed still deferred to November ([211]).
- One full due list — no weekly slice; annuals stay visible.

## Schema changes

- None. Backup inventory is ops (`.github/workflows/backup.yml`).

## New components / patterns added

- `dueFanoutContactIds` in [`src/lib/contacts/due.ts`](../../src/lib/contacts/due.ts) — due-row Log/Skip contract (unit-tested).
- `existingHouseholdIdForImport` in [`src/lib/contacts/sheet-import.ts`](../../src/lib/contacts/sheet-import.ts).

## Open questions surfaced

- None. P2 from [211] (silent PostgREST, soft-delete orphans, skip-vs-meet order, unbounded touch SELECT, dead cadence UI) still later.

## Surprises (read these before the next session)

- Reload the `ppp` MCP client after this lands — [211] already saw a live process still on the [180] rolling-cadence payload.
- First contacts dump appears on the next weekly cron (`0 8 * * 1`) or a manual **Weekly database backup** `workflow_dispatch`. Restore-smoke still dumps invoicing + library only.

## Carry-forward updates

- [x] components.mdc — dashboard due panel notes household fan-out
- [x] AGENTS.md inventory — due fan-out, pace, backup dump
- [x] tracker Phase 0 cadence paragraph rewritten
- [ ] new env vars — none
