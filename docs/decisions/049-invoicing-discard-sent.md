# 049 — Discard sent invoices

**Date:** 2026-06-22
**Module:** invoicing
**Tracker session:** ad hoc

## Built

- `discard` action on `/invoicing/invoices/[id]` now accepts `sent` invoices (still blocks `paid`).
- Sent invoice detail page: **Discard sent invoice** button with confirm copy explaining time entries return to unbilled.

## Decided

- **Reuse draft discard side effects** — unlink regular `time_entries`, soft-delete one-offs, hard-delete `invoice_line_items`, soft-delete invoice via `deleted_at`. No new DB status value; UI continues to derive `discarded` from `deleted_at`.
- **Keep `sent_at` and `status: sent` on discarded rows** — audit trail shows the invoice was sent before void.
- **Re-billing is manual generate** — widen date range on **Generate Invoice** after discard; no combine/reissue wizard.

## Schema changes

None.

## New components / patterns added

None.

## Open questions surfaced

None.

## Surprises (read these before the next session)

None.

## Carry-forward updates

- [ ] components.mdc updated — N/A
- [ ] AGENTS.md inventory updated — N/A
- [ ] new env vars documented — N/A
- [ ] tracker Open Questions updated — N/A
