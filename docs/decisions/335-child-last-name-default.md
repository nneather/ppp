# 335 — Child last name defaults in

**Date:** 2026-11-24
**Module:** contacts

## Built

- Adding a child on the household sheet starts with the same last name as adding a person: the first person already in the household.

## Decided

- One helper, `householdLastName()`, feeds both fields so they cannot drift. After a child is saved, the next one is prefilled again.

## Schema changes

- None.

## New components / patterns added

- None. The default lives in `household-form-sheet.svelte`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- The source is the first member by first name, which is the order `loadContactsLite` already uses for the adult field.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented
- [ ] tracker Open Questions updated
