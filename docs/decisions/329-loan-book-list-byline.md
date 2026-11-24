# 329 — Loan book list byline

**Date:** 2026-11-24
**Module:** library

## Built
- `{{loan.books}}` now reads *Title* by Author (due date). The title is `<em>`, which the mail sanitizer already allows.

## Decided
- "by" replaces the em dash. A book with no author is just the italic title and the due date.

## Schema changes
- None. The list is built when the email is queued, in `src/lib/email/render.ts` and the Edge copy in `supabase/functions/_shared/loan-email.ts`.

## New components / patterns added
- None.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- A reminder already sitting in the queue keeps the wording it was saved with. The next queue or refresh uses the new line.

## Carry-forward updates
- [x] components.mdc updated (no component change)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none added)
- [ ] tracker Open Questions updated
