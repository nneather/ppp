# 202 — Invoicing list mark-paid + undo

**Date:** 2026-08-17
**Module:** invoicing
**Tracker session:** ad-hoc — faster mark-paid from the invoice list

## Built
- `/invoicing/invoices` list: **Mark paid** on each `sent` row (no confirm). 10s undo toast restores `sent` and clears `paid_at`.
- Invoice detail: same one-tap mark-paid (confirm dialog removed). Paid invoices get a lasting **Mark unpaid** after the toast expires.
- Shared helper `src/lib/invoicing/mark-paid.ts` used by list + detail actions. Toast UI: `<InvoicePaidUndoToast>`.

## Decided
- One-tap + undo (Gmail / review-queue) instead of a confirm dialog — marking paid is frequent and reversible; discard stays confirm-gated.
- List undo is toast-only (Active filter hides the row). No Unpay on every paid list row — too easy to reverse old invoices. Detail keeps **Mark unpaid** for later recovery.
- Still `sent → paid` only (drafts stay unpayable from the list).

## Schema changes
- None.

## New components / patterns added
- `src/lib/invoicing/mark-paid.ts` — parse id + mark/unmark paid actions.
- `src/lib/components/invoice-paid-undo-toast.svelte` — 10s undo toast (list lifts above the Generate FAB).

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- Invoice status updates already set audit `revertible = false`, so undo cannot be an audit-log revert — it has to be a first-class `unmarkPaid` action.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars — n/a
- [x] tracker post-build row
