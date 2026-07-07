# 059 — Dashboard last-week invoice shortcut

**Date:** 2026-07-06
**Module:** invoicing
**Tracker session:** Ad-hoc — dashboard generate shortcut

## Built

- **Dashboard invoicing tile footer** when a **weekly-cadence** client has unbilled `time_entries` in the completed prior Chicago week (`previousMondaySundayWeekChicago()`).
- **One-click generate** — hidden form `POST /invoicing/invoices?/generate` with `client_id`, `period_start`, `period_end`; reuses existing generate action → draft redirect to `/invoicing/invoices/[id]` (recipients, message, send unchanged).
- **Tile restructure** — invoicing module card mirrors library tile: upper anchor to `/invoicing` (unbilled prior-week count) + optional `border-t` footer with generate button(s).
- **Load** — 8th dashboard query: unbilled entries in last week joined to `clients`; aggregate per weekly client into `lastWeekInvoiceCandidates`.

## Decided

- **Weekly-cadence clients only** — monthly clients (e.g. Fountain of Life) keep the generate sheet + month-span defaults. Rejected: one button for any client with last-week unbilled rows.
- **No new server action** — cross-route form POST to existing `?/generate` on `/invoicing/invoices`. Rejected: duplicating generate logic on dashboard or a dedicated shortcut action.
- **`hotkey="g"`** on the footer submit (Generate); disabled while any candidate form is pending to avoid double invoice-number consumption.
- **Filter weekly in app code** after `clients!inner` join (includes `deleted_at` skip) — avoids PostgREST nested-filter quirks.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/dashboard-invoicing-tile-footer.svelte`](../../src/lib/components/dashboard-invoicing-tile-footer.svelte) — per-candidate generate form, pending state, inline failure message from cross-route action.
- [`LastWeekInvoiceCandidate`](../../src/lib/types/invoicing.ts) — dashboard load + footer props type.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Dashboard load is now **8** Supabase round-trips (was 7); still under the 053 documented exception for `/dashboard`.

## Carry-forward updates

- [x] components.mdc updated
- [ ] AGENTS.md inventory updated (components live in components.mdc; no new server helpers)
- [ ] new env vars documented — N/A
- [ ] tracker Open Questions updated — N/A (ad-hoc)
