# 000 — Invoicing module retro (carry-forward to library)

**Date:** 2026-04-22
**Module:** invoicing
**Tracker session:** retroactive — captures lessons from sessions 1–5

This file is the consolidated retro from the invoicing build. It exists so the library module starts with the schema gaps, RLS patterns, and UX decisions already absorbed.

## Built

- Full invoicing flow: app shell + nav, time entry CRUD, invoice generation, PDF + Resend email send, mark-paid, settings page with full client + rate CRUD.
- Cross-cutting infra: `app_is_owner()` / `app_is_viewer_writer()` RLS helpers, audit log triggers on every table, soft-delete pattern, sheet/dialog component primitives.

## Decided (non-obvious)

- **Multi-recipient invoices**: `clients.email` migrated from `TEXT` to `TEXT[]`. Default CC list lives on `profiles.default_cc_emails text[]`, not a separate table. Decision: per-user defaults always go on `profiles` until a separate table is justified.
- **Soft-deleted clients still produce historical artifacts**: Edge Functions `generate-invoice-pdf` and `send-invoice` do **not** filter clients by `deleted_at`. Invoices outlive their parent client.
- **Client soft-delete is gated by dependents**: hard guard on existing `invoices`, soft-delete confirm on unbilled `time_entries`.
- **One-off charges**: implemented as `time_entries.is_one_off boolean` rather than as line items only. Keeps the ledger balanced for non-time work.
- **Rate history**: effective-dated rows in `client_rates`. Creating a new active rate auto-closes the prior one (sets `effective_to = day_before`). Updates are overlap-checked.

## Schema changes (post-baseline)

- `20260413120000_grant_generate_invoice_number.sql` — grant EXECUTE on `generate_invoice_number()` to authenticated.
- `20260413140000_invoices_rls_owner_helper.sql` — first SECURITY DEFINER helper (owner check) — fixed nested-RLS failures on invoicing tables.
- `20260413150000_rls_all_policies_use_helpers.sql` — extended helpers to **all** tables; added `app_is_viewer_writer(p_module text)`. Established the pattern for every future module.
- `20260413160000_time_entries_is_one_off.sql` — added `is_one_off` boolean.
- `20260414120000_invoice_pdf_redesign.sql` — PDF layout iteration (post-first-pass).
- `20260420120000_profiles_default_cc_emails.sql` — added `default_cc_emails text[]` to `profiles`.
- `20260420130000_clients_email_text_array.sql` — migrated `clients.email` scalar → `text[]`.

Also added but missing from `POS_Schema_v1.md`: `clients.address_line_1`, `clients.address_line_2`.

## New components / patterns added

- `src/lib/components/email-chips-editor.svelte` — multi-value text/email input with chips. Reusable for any `text[]` column.
- `src/lib/components/confirm-dialog.svelte` — destructive confirm with typed message.
- `src/lib/components/client-form-sheet.svelte` — entity-form-in-sheet pattern.
- `src/lib/components/rate-form-sheet.svelte` — child-record (effective-dated) form sheet pattern.
- `src/lib/components/default-cc-dialog.svelte` — global setting modal pattern.
- `src/lib/components/time-entry-sheet.svelte` — single sheet shared by create + edit.
- `src/lib/components/generate-invoice-sheet.svelte` — "generate derived record" wizard pattern.

All are listed in `.cursor/rules/components.mdc`.

## Surprises (read before the library build)

1. **RLS nested failures are silent until you write** — owner-only `EXISTS (SELECT FROM profiles ...)` policies look fine on read, then crash on cross-table INSERT. Use `SECURITY DEFINER` helpers from migration `20260413150000` from day one.
2. **Schema doc was incomplete vs. real UI needs** — every settings page surfaced fields the schema didn't list (multi-recipient emails, addresses, default CC). Library schema needs the same audit pass before Session 1, not during.
3. **"Settings page" is a multi-session track, not one bullet** — in invoicing it produced 5 new components and ~620 lines of server actions. Plan accordingly for library (people / series / ancient_texts canonicalization at minimum).
4. **Edge Functions and the app layer must agree on `deleted_at` semantics** — the app filters parents by `deleted_at IS NULL`; Edge Functions must not, or reprints break.
5. **Form action result discriminator (`kind`) is non-negotiable** — without it, the page can't route per-row errors back to the right card.

## Open questions surfaced (still open)

- One-off line items — `quantity × unit_price` ever needed, or is `total` always sufficient? (Currently `total`-only.)

## Carry-forward updates

- [x] `.cursor/rules/components.mdc` lists every reusable component
- [x] `.cursor/rules/db-changes.mdc` codifies the RLS helper rule and the schema-shape gotchas
- [x] `.cursor/rules/edge-functions.mdc` codifies the soft-delete-not-filtered rule
- [x] `AGENTS.md` lists the carry-forward inventory
- [x] `npm run supabase:gen-types` script added — replaces hand-written DB types
- [ ] First library Session 0 must do schema audit + Open Questions (≥10 per major entity) before any code
