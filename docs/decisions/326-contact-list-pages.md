# 326 — Contact lists get their own page

**Date:** 2026-11-24
**Module:** contacts
**Tracker session:** Christmas mailing plan, navigation follow-up

## Built

- `/contacts/lists/[listId]`: one list per page, bookmarkable.
  - Households come first, with address and status, filter chips, and a find box (name or address).
  - Confirm / Edit / Add address work as before.
  - "Add households or contacts" is a collapsed section at the bottom. It opens by default only when
    the list is empty.
  - The header holds Send postcards (ad hoc lists), Log cards sent, and Details….
- Lists tab: each list is a link to its page; the inline detail below the index is gone.
  `/contacts?tab=lists&list=<id>` redirects to the new page, so old links and bookmarks still work.
- Contacts header: a **Lists:** row of chips for ad hoc (seasonal) lists, e.g. Christmas cards,
  Potential Invite.
- The postcard screen's back link goes to the list page.

## Decided

- **No new "mailing list" kind.** Christmas cards is already the only `ad_hoc` household list, and
  the address and postcard tools key off households. The pain was navigation, not data. A new kind
  would be a migration and a second category for the same job.
- **The list page re-exports the `/contacts` form actions** (`export { actions } from
  '../../+page.server'`). The household sheet, add panel, log-cards dialog and confirm buttons all
  post to `?/…`, so they work unchanged.
- **Clone stays on the Lists index** (the copy icon), not the list page.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/contact-list-detail.svelte`: one list's members (moved out of
  `contacts-lists-panel.svelte`, which is now the index plus create/edit/clone/delete only).
- `loadHouseholdSheetExtras()` in `src/lib/contacts/server/loaders.ts`: the household sheet's
  children and grade history, shared by `/contacts` and the list page (moved out of the
  `/contacts` loader).

## Surprises

- The first page load after a fresh `vite dev` (or a dependency change) can log a Svelte
  `get_next_sibling … reading 'call'` error. It is gone on the next load, so it's a dev-server
  dependency re-optimize artifact, not app code.
