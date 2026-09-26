# 231 — Contacts default grouping

**Date:** 2026-09-26
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [230](230-contacts-roster-current-check.md)

## Built

- `/contacts` Contacts tab: **Group / then** (was Sort) plus **Set default**. The saved grouping is what `/contacts` opens on when `sort` is absent. An explicit `?sort=` still wins, including `?sort=name`.
- Group jump chips for every grouping (A–Z when grouped by name; Common / Quarterly / … or list names otherwise). Section headers show a count.
- Roster lines drop the field already shown by the section header, and drop list names and grades unless that key is the secondary sort. A household named the same as the person is omitted.
- Import sheet / vCard sits under the roster. Delete is a quiet ghost icon. The standing-list filter reads **All lists** so it is not a second “group” control.

## Decided

- Default lives on `profiles.contacts_default_sort` (NULL = name), same per-user-default pattern as task prefs. Owner-only write (existing profiles RLS). Households share the sort URL but do not get their own default control; frequency / last meet drop out of the household view as before.
- While the current grouping matches the saved one, the URL omits `sort`. Switching away writes `?sort=` even when the new value is name.
- List membership and grades stay off the default name scan. They come back when you group or then-sort by list, giving, or relationship.

## Schema changes

- `20260926203859_profiles_contacts_default_sort.sql` — nullable `profiles.contacts_default_sort` text + format check. Applied to prod.

## New components / patterns added

- `resolveContactSort` / `storedContactSortValue` / `contactSortEquals` in `src/lib/contacts/sort.ts`. `setContactsDefaultSortAction`. Page-local Group control (no new component).

## Open questions surfaced

- None. A default standing-list filter (open on F&M, not All lists) only if the grouping default is not the control Parker meant.

## Surprises (read these before the next session)

- Programmatic `<select>` value changes do not fire Svelte `onchange`; the control itself is fine from a real change.
- Verification set Frequency as the default, confirmed a bare `/contacts` reload, then set Name back. Prod default is name again.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — `sort.ts` default grouping
- [ ] new env vars — none
- [x] tracker session row
