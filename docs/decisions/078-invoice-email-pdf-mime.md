# 078 — Invoice email PDF MIME hardening

**Date:** 2026-07-09
**Module:** invoicing
**Tracker session:** ad-hoc (Sarah Svarstrom — PDF missing in Gmail)

## Built
- `send-invoice` Resend attachment now sets `content_type: 'application/pdf'` (was filename-only inference).
- Plain-text `text` body added alongside `html` via `buildEmailText()` so Resend builds `multipart/alternative` inside `multipart/mixed`.
- Edge Function redeployed (`npm run supabase:deploy-functions`).

## Decided
- Not an encoding bug: chunked `btoa` in `generate-invoice-pdf` matches Resend’s documented base64 `content` shape; Parker could open the PDF (including self test-sends). Asymmetry (works for sender, missing/unopenable for one Gmail recipient) pointed at under-specified MIME, not corrupt bytes.
- Fix = explicit attachment MIME type + plain-text sibling. Rejected rewriting `uint8ArrayToBase64` to Deno `encodeBase64` (consistency-only) and Resend hosted-URL (`path`) attachments (larger change, not warranted).

## Schema changes
- None.

## New components / patterns added
- None (Edge Function only).

## Open questions surfaced
- Owner must **Send test to myself**, then a real/resend to Sarah, and confirm in the Resend dashboard that the attachment is present, ~expected size, and typed `application/pdf`, then confirm Sarah can open it in Gmail. If asymmetry persists: follow [`docs/invoice-pdf-email-diagnostics.md`](../invoice-pdf-email-diagnostics.md) ([083](083-invoice-pdf-email-diagnostics.md)) before further MIME changes.

## Surprises (read these before the next session)
- Resend docs treat `content_type` as optional (derived from filename); still worth setting for gateway/client edge cases.
- HTML-only + attachment is a common MIME shape that some clients mishandle while others show the PDF fine.

## Carry-forward updates
- [ ] components.mdc updated (N/A)
- [ ] AGENTS.md inventory updated (N/A)
- [ ] new env vars documented (N/A)
- [ ] tracker Open Questions updated (N/A — ad-hoc)
