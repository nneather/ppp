# 211 — Contacts module review (bugs + system)

**Date:** 2026-08-24
**Module:** contacts / CRM
**Tracker session:** Review (post [210](210-contacts-semester-period-cadence.md))

## Built

- Read-only review of the contacts module after period cadence + Sheet1 import. Canvas: contacts-module-review. No product code changed.

## Decided

- Dual model stays: **person + frequency → meet due**; **household + list → cards**. Do not make list membership drive cadence.
- Period cadence stays (no dual-run with `cadence_days` UI).
- Desktop sidebar only; mailing send deferred; taxonomy (contacts ≠ households ≠ library `people` ≠ invoicing `clients`) unchanged.
- **Due Log/Skip on a collapsed household fans out** to all live **active scheduled** members (not “stop collapsing”).
- **Annuals stay on the 2026 due list**; a 2026 Log or Skip **counts toward `a:2027`** (pre-start fulfillment). Do not hide until Jan 1; do not let 2026 Skip eat 2027 without that being the intent — Skip in 2026 *is* skipping the 2027 obligation, which is what Parker wants if he taps Skip.
- **One full due list** — no weekly slice. Collapse + work/skip through it.
- **Christmas roster seed deferred to November** — not in the integrity session.

## Schema changes

- None this session. Follow-up may need none (action/UI only) except backup inventory (ops, not a migration).

## New components / patterns added

- None in app. Review canvas only.

## Findings (verified in code)

### P0

1. **Household collapse is display-only.** `selectContactsDue` collapses to one row (`due.ts`); due UI Log/Skip POST a single `contact_id` (`+page.svelte`, `dashboard-contacts-due.svelte`). `logHouseholdTouchAction` exists and is unused by the due strip. Spouse B remains due → household reappears. Conflicts with [210] Q7.
2. **Annual on-ramp vs Log/Skip.** `activePeriodForFrequency` returns `a:2027` (start `2027-01-01`) throughout 2026; `touchFulfillsPeriod` requires `touched_on >= start`, so a 2026 Log does not clear due. Skip writes `period_key=a:2027` and removes the contact for all of 2027.

### P1

3. **Due flood.** Live `list_contacts_due` (2026-08-24): `contacts_with_cadence=154`, `count=100` (cap), all `last_touched_on=null`. On-ramp made nobody start missed; the daily queue is the CRM.
4. **Pace / overdue dead.** Pace uses `activePeriodForFrequency('quarterly')` on a mixed pool, remaining after `limit`. `days_overdue` never fires because the active period always contains today.
5. **Christmas roster empty.** Seed list exists; [210] imported groups to standing lists / Potential Invite, not Christmas cards. Mass-add “Has address” exists but is not a guided ritual.
6. **MCP contract drift.** Tool description still rolling cadence ([180]); implementation is period ([210]); `effective_cadence_days` stubbed `0`. Running MCP process still served 180-shaped payloads (cadence_days=90, both spouses listed).
7. **R2 dumps omit contacts.** `backup.yml` has invoicing / library / projects only. 189 imported people are hosted-only; Free plan has no PITR.
8. **Sheet re-import partial couple** creates a new household when one spouse already exists (`sheet-import-action.ts`).
9. **History key collision.** On-ramp `q:2026-Q4` is Jul–Dec; `recentClosedPeriods` later scores civil Q4 (Oct–Dec) under the same key. History/pace are quarterly-only.

### P2 (pointer)

Silent PostgREST swallows (touches/skips/grades/clone); soft-delete orphans list members + children; household Log all includes retired; Skip-before-meet; unbounded touch SELECT vs PostgREST 1000-row default; dead cadence UI (`contact-cadence-fields`, profile default no-op).

### Sound

Owner-write RLS + module-read SELECT + GRANTs + audit on new tables; XOR membership + revive-by-PK on main add path; household delete blocked while live contacts remain; Chicago YMD; card `kind` does not feed due; C2 retired-only hide.

## Open questions surfaced

- None left from this review. Christmas Has-address seed returns November. Tracker Phase 0 cadence paragraph still stale until the integrity session rewrites it.

## Surprises (read these before the next session)

- Live MCP was still on the [180] contract while the working tree is [210] — reload the `ppp` client after period cadence lands.
- Tracker Phase 0 cadence / `no_reminders` rows are stale vs [210]; rewrite on the integrity session, do not dual-document.
- `updateContactCadenceDefault` always writes `null` (`parseCadenceDaysFromForm` is a stub). Dead path.

## Carry-forward updates

- [x] decision filed
- [x] PLAN.md session prompt + Next up
- [ ] components.mdc — no new components
- [ ] tracker Phase 0 cadence paragraph — rewrite when integrity session ships
- [ ] new env vars — none
