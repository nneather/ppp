# 083 — Invoice PDF email diagnostics runbook

**Date:** 2026-07-14
**Module:** invoicing
**Tracker session:** ad-hoc (outgoing PDF still asymmetric for one org recipient after 078)

## Built
- Owner-facing diagnostics runbook: [`docs/invoice-pdf-email-diagnostics.md`](../invoice-pdf-email-diagnostics.md) — what to collect when one recipient on the same org/email platform can open the invoice PDF and another cannot.
- PLAN.md Next up + session prompt updated to point at the runbook (replaces vague “verify 078” alone).

## Decided
- Do **not** change Edge MIME / PDF encoding until the minimum useful set is collected (Resend email id + attachment metadata, failing-user symptom/client, Show original PDF-part presence, manual Gmail attach A/B). Same-org asymmetry after 078 still points at inbound filtering or client rendering more often than corrupt bytes.
- Durable runbook in `docs/` (not chat-only) so the next session can diagnose without re-deriving the checklist.

## Schema changes
- None.

## New components / patterns added
- [`docs/invoice-pdf-email-diagnostics.md`](../invoice-pdf-email-diagnostics.md) — invoicing email PDF troubleshooting checklist (companion to [078](078-invoice-email-pdf-mime.md)).

## Open questions surfaced
- Owner: run the checklist on the next failing send (or a fresh resend to the failing mailbox) and return the minimum useful set before any further `send-invoice` changes.

## Surprises (read these before the next session)
- Same Google Workspace domain ≠ same attachment policy (OU / Safe Attachments / client).
- 078 already set `content_type: application/pdf` + plain-text body; verify the failing send is post-deploy before assuming MIME is still under-specified.

## Carry-forward updates
- [x] components.mdc updated (N/A)
- [x] AGENTS.md inventory updated (N/A — docs runbook only)
- [x] new env vars documented (N/A)
- [x] tracker Open Questions updated (pointer in POS_Invoicing)
