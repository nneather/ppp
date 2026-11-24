# 328 — Reminder lead in the email

**Date:** 2026-11-24
**Module:** library

## Built
- `{{loan.reminder_lead}}` is the owner's "Remind this many days before due" number. The insert menu and the checkout email both use it.
- The checkout email lists every book in the batch and says the reminder goes out that many days before the due date.
- The reminder email lists every book still out, each with its own due date, and names the soonest due date. The subject stays `{{book.title}}`, which reads "Title and N others" for a batch.

## Decided
- The lead is a number, the same value as the profile setting, filled in when the email is queued.
- A checkout of several books shares one due date, so "the due date" in that email is that day. A reminder can cover books due on different days, so it says "the soonest" and lets the list carry the rest.

## Schema changes
- `20261124220000_loan_template_multibook.sql` — rewrites the checkout and reminder template bodies. No table change.

## New components / patterns added
- None. The token is in `src/lib/email/variables.ts` and the Edge copy in `supabase/functions/_shared/loan-email.ts`.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- The reminder body does not repeat the lead. That email is already the reminder. The lead sentence lives on the checkout email, and the field is available to insert in either template.

## Carry-forward updates
- [x] components.mdc updated (no component change)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none added)
- [ ] tracker Open Questions updated
