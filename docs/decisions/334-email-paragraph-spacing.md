# 334 — Email paragraph spacing

**Date:** 2026-11-24
**Module:** library

## Built

- Checkout, reminder, and invoice mail now space each paragraph and list once, after the block. The editor and the preview use the same rhythm.
- `styleEmailDocument` inlines that spacing when the message is wrapped, because mail clients otherwise stack the browser's default top and bottom margins.

## Decided

- Space after a block, never before. A blank line between every paragraph, including the sign-off, was the odd part of the sent mail.
- Styles are applied at send time. The saved template stays plain HTML the sanitizer can round-trip.

## Schema changes

- None.

## New components / patterns added

- `styleEmailDocument` in `src/lib/email/sanitize.ts` and the Edge copy in `supabase/functions/_shared/loan-email.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- A message already in the inbox keeps the old spacing. The next send, including a reminder already queued, picks up the new spacing because the wrap happens at send time.
- `send-loan-message` and `send-invoice` were redeployed for this. The editor change still rides the next app deploy.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented
- [ ] tracker Open Questions updated
