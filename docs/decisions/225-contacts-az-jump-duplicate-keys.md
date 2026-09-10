# 225 — Contacts A–Z jump duplicate keys

**Date:** 2026-09-10
**Module:** contacts / CRM
**Tracker session:** Ad-hoc hotfix after [223](223-contacts-roster-search-density.md)

## Built

- `/contacts` loads again. The A–Z jump used `{#each letters as L (L)}`; people with no last name (e.g. Ben) grouped under their first initial at the top of the roster, then that letter appeared again among last names. Svelte 5 keyed-each duplicate keys crashed hydration, so the boot overlay never cleared.
- Name sort now uses last name with first-name fallback, matching `nameLetterHeader`. Letter indexes go through `uniqueGroupHeaders`.

## Decided

- **Align sort with group headers** rather than dumping missing last names into `#`. Madonna/Ben belong under M/B with everyone else.
- **Dedupe the jump rail anyway.** localeCompare vs first-character can still produce non-consecutive `#` groups; the keyed each must never see a repeated letter.

## Schema changes

- None.

## New components / patterns added

- `uniqueGroupHeaders` in `src/lib/contacts/sort.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Dev-only `each_key_duplicate` looks like a hung boot shell (“Loading ppp…”), not a red error page. SSR HTML is in the a11y tree underneath.
- Contact “Ben” (no last name) was the live repro.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — `uniqueGroupHeaders`
- [x] new env vars — none
- [x] tracker Open Questions — n/a
