# 322 — Christmas list address confirmation

**Date:** 2026-11-24
**Module:** contacts
**Tracker session:** Christmas mailing plan, Phase 2 (reply intake), UI half

## Built

- The list detail on `/contacts?tab=lists` now shows each household's one-line address and its status:
  **confirmed** (full address, `address_updated_on` this year), **unconfirmed** (full address, not
  checked this year), or **no address**.
- Filter chips with counts: All · Confirmed · Needs confirm · No address. Rows sort by name.
- **Confirm** (one tap) sets `address_updated_on` to today. **Undo** appears for the rest of the
  session and restores the prior value. **Edit / Add address** opens the existing household sheet,
  which already stamps the date when the address changes.
- `src/lib/contacts/address-status.ts`: `addressStatus`, `addressIsComplete`, `formatAddressOneLine`.
  The postcard screen reuses it to pick its default recipients.

## Decided

- "Confirmed" means `address_updated_on` falls in the **current calendar year**. No separate
  `confirmed_on` column: the plan already defines confirmation this way, and editing an address is
  itself a confirmation.
- Confirm needs a **complete** address (street, city, state, zip). The existing
  `householdHasMailingAddress` checks for *any* field, which is too loose for mailing.
- The 31 imported addresses carried a placeholder `address_updated_on = 2026-01-01`, so all of them
  would have counted as confirmed. They were cleared to null on 2026-11-24, before this shipped
  (backup kept outside the repo).

## Schema changes

- None.

## New components / patterns added

- `setHouseholdAddressConfirmed` form action on `/contacts`.

## Surprises (read these before the next session)

- `/Applications/Google Chrome.app` on this Mac is a stale **v90** (2021) leftover (Parker's real Chrome is current). It can't render Tailwind v4 and has no
  `Array.prototype.toSorted`. Use Playwright's cached Chromium
  (`~/Library/Caches/ms-playwright/chromium-*`) for headless screenshots.
- The app shell scrolls inside an inner container, so full-page screenshots come back blank. Scroll
  the target into view and capture the viewport instead.
