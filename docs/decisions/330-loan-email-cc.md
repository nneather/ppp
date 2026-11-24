# 330 — Loan emails copy the invoice CC

**Date:** 2026-11-24
**Module:** library

## Built
- Checkout and reminder emails CC `profiles.default_cc_emails`, the same list invoices pre-fill.
- The address is left off the CC line when it is already the recipient.

## Decided
- Reuse the invoice default CC instead of a second loan-only address. Changing it under Settings → Invoicing changes both.

## Schema changes
- None.

## New components / patterns added
- `ccBesidesRecipient` in `src/lib/email/loans.ts` and the Edge copy in `supabase/functions/_shared/loan-email.ts`.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- The copy happens at send time inside `send-loan-message`, including the daily reminder drain. A message already marked sent is not re-sent.

## Carry-forward updates
- [x] components.mdc updated (no new component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none added)
- [ ] tracker Open Questions updated
