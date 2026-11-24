# 321 — Library loans and email templates

**Date:** 2026-11-24
**Module:** library
**Tracker session:** ad-hoc

## Built

- A book copy can be checked out to one contact. The contact’s email and name are copied onto the loan. Checkout sends immediately. A reminder is queued 30 days later (Chicago calendar) and repeats until the book is marked returned.
- The next reminder’s date and HTML can be edited without changing the template. After it sends, the following reminder is rendered from the current template.
- Owner template editor at `/settings/email-templates`: folders, TipTap (paragraph, heading, list, link, button), closed merge fields, preview. Seeded Library checkout and reminder templates.
- `/library/loans` lists open loans, oldest first. The contact sheet says how many books that person has out. Book detail prefers an open loan over the old `borrowed_to` note.
- Edge function `send-loan-message` and a daily GitHub Action. Claiming a row (`queued` → `sending`) makes a double run safe. One open reminder per loan.

## Decided

- Households are not the borrower. The person is.
- Library readers can see who has a book. They cannot check a book out, read message HTML, or edit templates. No new permissions slug.
- A failed send stays failed and does not schedule the next reminder. Retry is on the loan card.
- Sent messages are not soft-delete revertible. Loans, folders, templates, and bindings are.
- Old `borrowed_to` text stays a note. It is not migrated into contacts.
- Copies are a count. The loan does not name which physical copy when `copy_count` is greater than 1.

## Schema changes

- `supabase/migrations/20261124145249_library_loans_and_email_templates.sql` — `email_template_folders`, `email_templates`, `email_template_bindings`, `book_loans`, `book_loan_messages`. RLS, grants, audit, seeded checkout and reminder.
- `supabase/migrations/20261124145857_book_loan_one_open_reminder.sql` — one open reminder (`queued`, `sending`, or `failed`) per loan.
- Local migration history was aligned to the already-applied remote file `20261118220050_revoke_authenticated_execute_trigger_functions.sql`. The SQL was not re-run.

## New components / patterns added

- `<BookLoanCard>`, `<LoanCheckoutSheet>`, `<LoanReminderSheet>`, `<EmailBodyEditor>`.
- `src/lib/email/` render, sanitize, and the closed variable catalog. The Edge function keeps a Deno copy in `supabase/functions/_shared/loan-email.ts` because the bundler does not import `src/lib`.

## Open questions surfaced

- The function is deployed and `LOAN_REMINDER_CRON_SECRET` is set on the hosted project and as the GitHub Actions secret. The first real checkout is the send smoke. `LIBRARY_LOAN_RESEND_FROM` is unset; the default is `Parker Neathery <parker@npneathery.com>`.

## Surprises (read these before the next session)

- Supabase CLI 3.2 `db push` and `gen types` default to local Postgres. This repo’s scripts now pass `--remote` (and `--yes` on apply).
- `npm install` of TipTap relinked `node_modules/.bin/dotenv` to the `dotenv` package’s own CLI and broke every `dotenv -e` script. Scripts now call `dotenv-cli`.
- A remote migration `20261118220050` was missing locally under a different timestamp (`20261118160000`). The local file was renamed to the remote timestamp so push could proceed.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented in `supabase/README.md`
- [x] tracker — ad-hoc, no session row
