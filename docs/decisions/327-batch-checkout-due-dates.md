# 327 — Batch checkout and movable due dates

**Date:** 2026-11-24
**Module:** library

## Built
- Several books can go out to one person in one step, from a book, the library list, or `/library/loans`. One email lists the batch. Each copy is still its own loan.
- `book_loans.due_on` is the day that copy should come back. Checkout sets it to today plus the owner's default length (30 days).
- One reminder per person. Its date is the earliest open due date minus the lead (7 days). If that day has passed, the reminder is today. Returning one book drops it from the list. Returning the last book cancels the reminder.
- The loan card shows the due date, **+2 weeks**, and a date field. Either change reschedules that person's reminder. Editing the reminder's own date does not change the due date.
- `{{loan.books}}` is a bullet list. `{{book.title}}` is the single title, or "Title and N others." A template that omits the token still gets the list appended at send time. Parker's edited checkout and reminder wording was left as he wrote it.

## Decided
- Each book stays its own loan so one copy can come back on its own. The reminder is one email per person, not one email per book.
- The lead and the loan length live on the owner profile and are edited on the email templates page. A checkout can still pick a different due date for that batch.
- After a reminder sends, the next one is computed the same way from whatever is still out. Inside the lead window that date is today, so the daily drain sends again until the books are back or the due date moves.

## Schema changes
- `20261124210000_loan_due_dates_and_batch.sql` — `book_loans.due_on`, `profiles.loan_due_days` (1–366, default 30), `profiles.loan_reminder_lead_days` (0–60, default 7), `book_loan_messages.contact_id` with `loan_id` nullable, one open reminder per contact.

## New components / patterns added
- Checkout sheet now holds a book list, a contact, and a due date. `GET /library/loan-books.json` and `GET /library/loan-defaults.json`.
- `nextReminderYmd` in `src/lib/email/loans.ts` matches the copy in `supabase/functions/_shared/loan-email.ts`. `loan.books` is inserted as already-safe HTML.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- The seeded templates had already been rewritten, so the migration's exact-body update changed zero rows. The send path appends the book list when `{{loan.books}}` is missing. That is what keeps a batch from going out under only the first title.
- There were no open loans to backfill.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none added)
- [ ] tracker Open Questions updated
