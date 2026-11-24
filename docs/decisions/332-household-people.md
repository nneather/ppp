# 332 — Add people to a household (and merge)

**Date:** 2026-11-24
**Module:** contacts

## Built

- A **People** section on the household sheet, above Children:
  - Lists the household's adults. **Remove** gives that person a household of their own again, and
    is blocked for the last person.
  - **Add person → Someone new:** first and last name. Creates the contact in this household with
    the same check-in frequency as the person already there (default quarterly). The last name is
    prefilled.
  - **Add person → Existing contact:** search and pick to move them in.
  - **Rename suggestion** (pre-checked): "Jordan and Taylor Gibbs"; for different last names, full
    names. On success the sheet's Name field updates too, so a later "Update household" can't undo
    the rename.
- `suggestHouseholdName()` in `names.ts`, plus tests.
- `loadContactsLite()`: every live contact with minimal columns, used on `/contacts` and the list
  page. It also replaces the list page's own contacts query.

## Decided

- **Auto-merge (Parker, 2026-11-24).** When a moved contact's old household is left with nobody in
  it, it is folded into the target:
  - List memberships move over. Where the target is already on a list, the old membership is
    soft-deleted, so there are no duplicates.
  - Children move over.
  - Postcard sends that are `pending` or `created` move over, so the never-mail-twice guard still
    covers the merged household.
  - Grade history moves over. Empty grades and notes are filled; nothing is overwritten.
  - The old address fills the target only if the target has none. If both have one, the target's
    is kept and a note names the dropped address.
  - The old household is soft-deleted, after a re-check that it is really empty.
  - Rejected: leaving the empty household for manual cleanup. That's how a duplicate card gets
    mailed.
- Still allowed from the contact sheet: clearing a contact's household while editing.
  Creating a contact always makes a household (shipped earlier today as
  "contacts: new contacts always get a household").

## Independent review (before ship) — fixed

- **Stale sheet undoing a merge:** the open sheet's address, grades, notes and list checkboxes were
  seeded only on open. After a merge, "Update household" would have nulled the merged address and
  dropped the merged lists. The actions now return the household's state, and the sheet re-seeds.
- **No transaction / no retry:** the order is now fold → move contact → soft-delete the old
  household. Every fold step is idempotent, so a part-way failure leaves the contact where they were
  and pressing Add again finishes. A real single-transaction RPC would need a migration; deferred.
- **Count errors read as "empty":** every count now checks its error and aborts.
- **Remove** cleans up its new household if moving the contact fails, and the sheet explains what
  Remove does.

## Schema changes

- None.
