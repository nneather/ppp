# 004 — Invoice number drift hotfix

**Date:** 2026-04-27
**Module:** invoicing
**Tracker session:** Hotfix (no tracker session)

## Built

- New migration [supabase/migrations/20260427170000_harden_invoice_number_generator.sql](../../supabase/migrations/20260427170000_harden_invoice_number_generator.sql):
  - One-shot `setval('invoice_number_seq', MAX(suffix), true)` to clear the immediate collision.
  - Replaced `public.generate_invoice_number()` with a `plpgsql` self-healing version that takes a transaction-scoped advisory lock, recomputes the max suffix from `public.invoices`, bumps the sequence past it if it's behind, then `nextval`s and formats.

## Decided

- **setval + harden** rather than setval-only. Cause was a one-time service-role copy from the old staging project on 2026-04-23 (audit_log shows 8 INSERTs at the same instant with `changed_by = NULL`), but the same pattern would silently recur on any future restore or manual SQL Editor insert. Hardening the RPC is ~20 LOC and removes that whole failure mode.
- **Advisory lock + sequence-as-source-of-truth** rather than deriving the number directly from `MAX(invoices) + 1`. The latter races: two concurrent callers compute the same max before either inserts. Keeping `nextval` as the actual allocator (atomic, concurrency-safe) and using the lock only to guard the heal-then-nextval window keeps the design simple.
- **Did not** add `23505` retry in [src/routes/invoicing/invoices/+page.server.ts](../../src/routes/invoicing/invoices/+page.server.ts). The RPC is now self-correcting on the next call, so app-side retry would be belt-and-suspenders. Reconsider if a duplicate ever surfaces again.

## Schema changes

- `20260427170000_harden_invoice_number_generator.sql` — heals `invoice_number_seq` and replaces `generate_invoice_number()` with self-healing variant.

## New components / patterns added

- None. The advisory-lock + self-heal pattern is reusable for any future sequenced display id (mirror of what's noted in [AGENTS.md](../../AGENTS.md) under Database carry-forward).

## Open questions surfaced

- None. The RPC is now idempotent against future drift; no follow-up required.

## Surprises (read these before the next session)

- The 2026-04-23 staging-to-prod data copy did not advance `invoice_number_seq`. Any other sequences imported the same way would have the same problem. (None exist today; baseline only defines `invoice_number_seq`.)
- `npm run supabase:gen-types` is referenced in [AGENTS.md](../../AGENTS.md) but is not actually defined in `package.json`. Function-only changes don't require regen, so this didn't bite, but the script should be added or the docs corrected. Filed as a follow-up note here.

## Carry-forward updates

- [ ] components.mdc updated — N/A
- [ ] AGENTS.md inventory updated — `generate_invoice_number()` description still accurate
- [ ] new env vars documented — none added
- [ ] tracker Open Questions updated — N/A (hotfix, not session)
