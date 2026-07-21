# 098 — Resend inbound webhook secrets set

**Date:** 2026-07-21
**Module:** projects
**Tracker session:** Ad-hoc ops — close [077](077-email-to-task-and-domain-colors.md) owner follow-through

## Built
- Confirmed Resend webhook `email.received` → `https://objtrdmmqlndtfddtzan.supabase.co/functions/v1/email-inbound-task` (enabled).
- Pulled live Svix `signing_secret` from Resend API and re-applied Edge secrets on prod:
  - `RESEND_WEBHOOK_SECRET`
  - `INBOUND_TASK_PROJECT_ID` = Email Inbox seed UUID
  - `INBOUND_TASK_ALLOWED_SENDERS` = documented forwarder allowlist
  - `INBOUND_TASK_RECIPIENT` = `tasks@zeneoldai.resend.app`
- `RESEND_API_KEY` already present (needed for Receiving API body fetch).

## Decided
- Re-set even though digest names already existed — PLAN still treated secrets as unfinished, and re-applying from the live Resend webhook avoids a stale/placeholder `whsec_`.

## Schema changes
- None

## New components / patterns added
- None

## Open questions surfaced
- ~~Owner smoke: forward one message from an allowlisted mailbox to `tasks@zeneoldai.resend.app` and confirm a task under Email Inbox / Opportunity Now on `/tasks`.~~ — **confirmed working** 2026-07-21.

## Surprises (read these before the next session)
- Resend `GET /webhooks/{id}` returns `signing_secret` — no Dashboard copy step required when the API key has webhook read access.
- `supabase secrets list` only shows digests; use `updated_at` to confirm a refresh.

## Carry-forward updates
- [x] PLAN.md Projects row + Next up email-capture note cleared
- [ ] components.mdc — N/A
- [ ] AGENTS.md inventory — N/A
- [ ] new env vars documented — already in supabase/README.md
- [x] tracker Open Questions — 077 owner secrets step closed here
