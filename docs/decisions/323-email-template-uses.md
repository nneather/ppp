# 323 — Email template uses

**Date:** 2026-11-24
**Module:** library, invoicing

## Built
- `{{loan.due_on}}` is the checkout day plus the loan’s interval, formatted like the checkout date. The seeded reminder mentions it only while its body is still the original seed.
- The invoice email renders the template bound to `invoicing.invoice`. The note typed at send time fills `{{invoice.message}}`. The PDF stays an attachment. If that template is missing, send falls back to the old card.
- `/settings/email-templates` lists each send and which template it uses. The editor no longer has the two checkboxes.

## Decided
- A send always points at one template. Unchecking a box would leave the send pointing nowhere, so the control is a dropdown that moves the pointer.
- New sends are a row in `EMAIL_TEMPLATE_USES`, not another checkbox.
- The due date does not follow a one-off reminder date. Moving only the next reminder leaves `{{loan.due_on}}` on checkout plus the interval.
- The seeded invoice is paragraphs and a heading the editor can round-trip. The old table card is the fallback, not the editable body.

## Schema changes
- `20261124193000_invoice_email_template.sql` — Invoicing folder, Invoice template, `invoicing.invoice` binding, and the unedited reminder sentence. No new columns.

## New components / patterns added
- None. Uses live on the existing templates page.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- The Edge renderer is a copy in `supabase/functions/_shared/loan-email.ts`. A new token has to land there and in `src/lib/email/variables.ts` or the function leaves `{{token}}` in the mail.
- Already queued loan emails keep the HTML they were rendered with. `{{loan.due_on}}` shows up on the next reminder, or when a queued reminder is saved again.

## Carry-forward updates
- [x] components.mdc updated (no new component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [ ] tracker Open Questions updated (no tracker for this)
