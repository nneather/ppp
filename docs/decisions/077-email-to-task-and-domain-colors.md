# 077 — Email-to-task + project domain colors

**Date:** 2026-07-09
**Module:** projects
**Tracker session:** ad-hoc (MYN capture + /projects clarity)

## Built
- Resend Inbound → MYN task Edge Function `email-inbound-task` (Svix-signed webhook; body via Receiving API; inserts into seeded **Email Inbox** under Work).
- `project_tasks.notes` + `source_email_id` (partial unique for webhook idempotency); notes editable in task sheet; list shows a notes icon.
- `projects.color` palette key + curated 12-swatch picker on root domains; child rows get a left color rail; filter bar + dashboard status strip show domain dots.
- Migration `20260709164016_projects_email_inbox_and_domain_colors.sql` applied to prod; types regenerated; function deployed.

## Decided
- Receiving address: Resend free managed domain `tasks@zeneoldai.resend.app` (no custom-domain upgrade). Configurable via Edge secret `INBOUND_TASK_RECIPIENT` so a branded subdomain can replace it later without code changes.
- Sender allowlist (`INBOUND_TASK_ALLOWED_SENDERS`): forwarder From addresses — `parker.neathery@gmail.com`, `neal.p.neathery@gmail.com`, `parker.neathery@229project.com`, `parker.neathery89@covenantseminary.edu`, `parker.neathery@covenantseminary.edu` (optional `parker@npneathery.com`). Not “any mail that lands in those inboxes.”
- Destination: dedicated Email Inbox child project (fixed UUID `a1b2c3d4-e5f6-7890-abcd-ef1234567890`), not nullable `project_id`.
- Colors: curated palette keys + static Tailwind class maps (not free-form hex — Tailwind cannot compile dynamic arbitrary classes).
- Root domains stay non-editable in the metadata sheet; color uses a dedicated `setProjectColor` action.

## Schema changes
- `20260709164016_projects_email_inbox_and_domain_colors.sql` — `projects.color`; `project_tasks.notes` + `source_email_id` + unique partial index; seed Email Inbox under Work.

## New components / patterns added
- `src/lib/projects/email-inbound.ts` (+ tests) — subject clean, allowlist, HTML→text helpers.
- `src/lib/projects/project-colors.ts` — palette keys + DOT/RAIL/ROW_TINT class maps.
- `src/lib/components/project-color-picker.svelte` — dialog swatch grid posting `?/setProjectColor`.
- `supabase/functions/email-inbound-task/` — inbound webhook handler.

## Open questions surfaced
- Parker must finish Resend webhook + `supabase secrets set` (full allowlist in supabase/README.md) before forwards create tasks.
- Whether Email Inbox should later auto-file by subject tag — deferred.

## Surprises (read these before the next session)
- Resend inbound webhooks carry metadata only; body requires a second Receiving API call with `RESEND_API_KEY`.
- Svix secrets are `whsec_<base64>`; signature header entries are `v1,<base64>` (standard base64, not URL-safe).
- Security review: allowlist must be re-checked against Receiving API `from` after fetch (spoofed webhook metadata) — shipped in the same session.
- Bugbot: task title `inline-flex` overflowed on mobile; color dot needed a larger touch target; notes pushed save buttons off-screen — sticky save bar + touch-target fixes shipped.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (supabase/README.md)
- [ ] tracker Open Questions updated (N/A — ad-hoc)
