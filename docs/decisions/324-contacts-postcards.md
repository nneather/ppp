# 324 — Postcards via Lob

**Date:** 2026-11-24
**Module:** contacts
**Tracker session:** Christmas mailing plan, Phase 3 (`docs/POS_Contacts_Christmas_Mailing_Plan.md`)

## Built

- `/contacts/postcards/[listId]`, opened from **Send postcards** on an ad hoc list. Three panels:
  - **Artwork:** size, front upload, back message with a live preview and the address-box guide, return address, price per card.
  - **Recipients:** confirmed this year and not yet mailed are pre-checked.
  - **Proof & send:** test proofs, mail one to me, then the batch.
- **Test proofs** (test key, up to 3 selected households) render Lob PDF proofs and mail nothing.
- **Mail one to me** sends one live card to the return address.
- **The batch** sends live, 2 households per request, and the browser loops until the selection is done.
- A live batch logs a `card` touch for each mailed household's members. These touches are deduped by
  note and year, and each chunk fills in any that were missed earlier.
- Ported from HeLOS: the back-message HTML builder (same geometry as the verified 5x7 render, set in
  Lora instead of the 229 brand font) and the Lob request client (timeout, retry, Idempotency-Key).

## Decided

- **Never-twice is a DB reservation, not Lob idempotency.**
  - The batch inserts a `pending` `postcard_sends` row *before* calling Lob. The partial unique index
    on `(list_id, household_id)` where status is pending or created turns a second tab or a retried
    POST into a 23505, which means skip.
  - After the call, the row resolves to `created` or `failed`. A stuck `pending` row keeps blocking
    and shows as "Pending — check Lob".
  - Rejected: insert-after-Lob. The independent review showed it double-mails on concurrent tabs or
    a crash between the Lob 200 and the insert.
- **Idempotency key per reservation row**, not per household. A retry after a corrected address must
  not get Lob's cached response.
- **"Mail one to me" uses a fresh key per click.** A per-day key would replay the old artwork.
- **Owner check in every action**, on top of RLS.
- **`maxDuration: 300`** on the route, and chunks of 2.
- **Price is typed in** (from the Lob dashboard) rather than hard-coded. Lob's pricing varies by plan
  and size.
- **The design is stored per list** (`postcard_designs`), so next year's cloned list starts fresh but
  this year's work survives reloads.

- **Parker's postcard decisions (2026-11-24, plan doc on main):** 5x7 is now the default size, the
  back is a short typed message, the return address is his home, and the price is from $0.905/piece.
  **Live sends go only to addresses confirmed this year.** The server enforces this in `sendBatch`,
  and the screen disables unconfirmed rows. `price_cents` is an int, so $0.905 is stored as 91¢ and
  the estimate runs about $0.005/card high.

## Schema changes

- `20261124200000_contacts_postcards.sql`:
  - `postcard_designs` (one per list).
  - `postcard_sends` (every Lob call; pending/created/failed; the never-twice unique index).
  - Private `postcard-artwork` bucket with owner-only, own-prefix Storage policies.
  - `database.ts` is **not** regenerated in this commit (code uses untyped client calls). Run
    `npm run supabase:gen-types` after the push.

## New env vars

- `LOB_TEST_API_KEY` (`test_…`) and `LOB_LIVE_API_KEY` (`live_…`) go in `.env.local` **and** Vercel.
  The screen shows which are missing. A key with the wrong prefix is refused.

## Open questions surfaced

- How Lob caches an errored idempotent request is unverified. It no longer matters for correctness
  (the DB reservation is the guard), but it's worth knowing.

## Surprises (read these before the next session)

- The independent review found 3 real double-mail or duplicate-touch paths in the first draft, all
  around ordering the record write relative to the Lob call. Keep the reserve → call → resolve
  order.
