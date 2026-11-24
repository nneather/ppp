# 333 — Checkout without an email

**Date:** 2026-11-24
**Module:** library

## Built
- A contact with no email can get one typed in the checkout sheet. That address is saved on the contact, and the checkout email still goes out.
- Typing a full name such as "Alex Cravens" finds that contact. An exact match is selected, so Check out is available when they already have an email.
- Or the books can be checked out with no email. No checkout email is queued, and no reminder is queued until some open loan for that person has an address.

## Decided
- The choice is on the sheet, not a trip to the contact page. "Check out without an email" is explicit, so a blank field does not silently skip the mail.
- `book_loans.recipient_email` may be null. The shape check still rejects a bad address.

## Schema changes
- `20261124230000_loan_email_optional.sql` — `recipient_email` nullable.

## New components / patterns added
- `resolveCheckoutEmail` in `src/lib/email/loans.ts`.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- Adding an address later on the loan card starts the reminder. A checkout with no email does not.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none added)
- [ ] tracker Open Questions updated
