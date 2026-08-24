# 210 — Contacts semester investment (period cadence + sheet import)

**Date:** 2026-08-24
**Module:** contacts / CRM
**Tracker session:** Sessions 4–6 (engine + import + densify)

## Built

- Calendar-period meet cadence replacing rolling `cadence_days` / `no_reminders` UI: `contacts.frequency` = common | quarterly | semiannual | annual | none.
- Period engine (`src/lib/contacts/period.ts` + rewritten `due.ts`): Q = calendar quarters; S = Jan–Jun / Jul–Dec; A = calendar year. Import on-ramp: Q/S through 2026-12-31 (`q:2026-Q4` / `s:2026-H2`); A due 2027-12-31. Misses do not stack. One due list sorted oldest last-meet first; household collapse for couples.
- Skip this period via `contact_period_skips` (not a meet). History outcomes: hit / skipped / missed.
- Lists `kind` standing | ad_hoc; clone ad-hoc; Contacts filter by standing list (`list_filter`).
- Household giving A–E + relationship A–D + collapsed grade timeline; `address_updated_on` (import stamp 2026-01-01).
- `household_children` CRUD on household sheet; vCard apply (birthday + empty email/phone).
- Pace strip on `/contacts` + period history; dashboard Due to meet uses period rows + Skip.
- Sheet1 + People for Things CSV import (160 households / 189 contacts; Potential Invite ad hoc; Christmas cards unseeded). Grill capture: `brainstorms/2026-08-24-contacts-semester-invest.md`.

## Decided

- Replace rolling cadence (not dual systems) — Kolbe 7-2-8-4: one due list, periods hidden.
- Annual = calendar year (not Jul 31); first annual deferred to 2027.
- Grades on household with visible collapsed timeline.
- Groups = Lists with standing vs ad hoc; People for Things → Potential Invite (not Christmas seed).
- Couples → two contacts, one household; due collapses.

## Schema changes

- `20260824190000_contacts_period_cadence_v1.sql` — frequency, birthday, list kind, period skips, grade columns + timeline, children, address_updated_on.

## New components / patterns added

- `src/lib/contacts/period.ts`, `sheet-import.ts`, `vcard.ts`, `server/sheet-import-action.ts`, `server/vcard-import-action.ts`
- `scripts/contacts-sheet-import.ts` — one-shot hosted import
- Contact form frequency select; household grades/children/as-of; lists kind + clone; dashboard Log+Skip

## Open questions surfaced

- Group column values like `STL, Timothy` become list names as-is — may want merge later.
- People for Things name variants (e.g. Sam Bromell vs Sam and Amy Broomell) may miss some Potential Invite memberships.
- Parker still owes Mac Contacts `.vcf` for birthday/email fill.

## Surprises (read these before the next session)

- Sheet1 export has ~160 people (more than the ~50 visible in the first screenful).
- Address parser assumes single-word city when no comma (`Lancaster PA`); comma form preferred for multi-word cities.

## Carry-forward updates

- [x] components.mdc — note frequency / grades / children (Session 4 UI)
- [x] AGENTS.md inventory — contacts helpers
- [x] tracker Sessions 4–6
- [ ] new env vars — none
