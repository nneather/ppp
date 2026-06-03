# 040 — Security Advisor hardening

**Date:** 2026-05-28  
**Module:** platform / supabase  
**Tracker:** n/a

## Built

- Migration `20260528140000_security_function_search_path_and_revoke_anon.sql` — `SET search_path = public` on five utility functions; `REVOKE EXECUTE … FROM anon` on exposed SECURITY DEFINER helpers + `generate_invoice_number`.
- Migration `20260528140100_pg_trgm_extensions_schema.sql` — `pg_trgm` moved to `extensions` schema.
- Migration `20260528150000_revoke_public_execute_security_definer.sql` — `REVOKE EXECUTE … FROM PUBLIC` + `GRANT … TO authenticated` on seven SECURITY DEFINER functions (fixes anon Advisor rows; see Surprises).

## Decided

- **Do not** `REVOKE EXECUTE FROM authenticated` on trigger-only or RLS-helper functions in this pass — breaks policies or triggers; clears `authenticated_*` Advisor rows only via private-schema refactor (deferred).
- **Accept** remaining `authenticated_security_definer_function_executable` Advisor rows — RLS policies and intentional `.rpc()` calls require `authenticated` EXECUTE on SECURITY DEFINER helpers.
- **Waive** `auth_leaked_password_protection` on **Free plan** (Pro required per Supabase); revisit if billing upgrades.
- **Defer** moving RLS helpers to a non-API `private` schema — large policy churn; optional on Pro upgrade.

## Schema changes

- `20260528140000_security_function_search_path_and_revoke_anon.sql`
- `20260528140100_pg_trgm_extensions_schema.sql`
- `20260528150000_revoke_public_execute_security_definer.sql`

## Leaked password protection — waived (Free plan)

HaveIBeenPwned check requires **Pro** ([password security docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). Owner stays on Free tier for now — Security Advisor will keep one `auth_leaked_password_protection` WARN; that is expected.

Optional without Pro: tighten Email provider password rules (min length, character classes) in [Auth → Providers → Email](https://supabase.com/dashboard/project/objtrdmmqlndtfddtzan/auth/providers).

## Post-push smoke (owner)

1. Sign in; `/library?q=test` keyword search (trigram indexes).
2. `/invoicing` → generate invoice number (RPC).
3. `/library/search-passage` with a passage query (RPC).
4. Edit a book field → confirm new `audit_log` row in `/settings/audit-log`.
5. Re-run **Security Advisor** — expect:
   - Cleared: `function_search_path_mutable`, `anon_security_definer_function_executable`, `extension_in_public`.
   - Remaining (accepted): `authenticated_security_definer_function_executable`, `auth_leaked_password_protection` (Free plan).

## Accepted / waived Advisor warnings

| Lint | Status | Why |
|------|--------|-----|
| `authenticated_security_definer_function_executable` | Accepted | `app_is_*` / `app_module_*` in RLS; `library_merge_*` + `generate_invoice_number` + `search_scripture_refs` via `.rpc()`; trigger functions need `authenticated` EXECUTE |
| `auth_leaked_password_protection` | Waived (Free) | Pro-only feature; not actionable on current plan |

Functions flagged for `authenticated_*` (documented, not bugs): `app_is_owner`, `app_is_viewer_writer`, `app_module_access_level`, `app_has_module_read`, `enforce_books_viewer_columns`, `handle_new_user`, `write_audit_log`, `library_merge_people`, `library_merge_publishers`, `library_merge_ancient_texts`.

## Surprises (read these before the next session)

- **`REVOKE FROM anon` is insufficient** when `EXECUTE` is granted to `PUBLIC` (Supabase default). `20260528140000_*` left seven `anon_*` Advisor rows until `20260528150000_*` revoked `PUBLIC`. Merge RPCs already used `REVOKE ALL … FROM PUBLIC`, which is why they dropped off the anon list earlier.

## Carry-forward updates

- [x] Follow-up migration `20260528150000_*` shipped
- [ ] Owner: post-push smoke + Security Advisor re-run (confirm anon rows gone)
- [ ] `PLAN.md` optional one-line under Supabase workflow
