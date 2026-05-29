# 040 — Security Advisor hardening

**Date:** 2026-05-28  
**Module:** platform / supabase  
**Tracker:** n/a

## Built

- Migration `20260528140000_security_function_search_path_and_revoke_anon.sql` — `SET search_path = public` on five utility functions; `REVOKE EXECUTE … FROM anon` on exposed SECURITY DEFINER helpers + `generate_invoice_number`.
- Migration `20260528140100_pg_trgm_extensions_schema.sql` — `pg_trgm` moved to `extensions` schema.
- Runbook below for **leaked password protection** (Dashboard-only).

## Decided

- **Do not** `REVOKE EXECUTE FROM authenticated` on trigger-only functions in this pass — risk of breaking INSERT triggers; anon revoke is the high-value fix.
- **Accept** remaining `authenticated_security_definer_function_executable` Advisor rows — RLS policies and intentional `.rpc()` calls require `authenticated` EXECUTE on SECURITY DEFINER helpers.
- **Defer** moving RLS helpers to a non-API `private` schema — large policy churn for marginal gain after anon revoke.

## Schema changes

- `20260528140000_security_function_search_path_and_revoke_anon.sql`
- `20260528140100_pg_trgm_extensions_schema.sql`

## Owner manual: leaked password protection

Requires **Pro plan** ([Supabase password security docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

1. [Auth → Providers → Email](https://supabase.com/dashboard/project/objtrdmmqlndtfddtzan/auth/providers)
2. Open **Password** / password-strength settings for the Email provider.
3. Enable **Prevent use of leaked passwords** (HaveIBeenPwned).
4. Optional: minimum length ≥ 8; require digits + upper + lower + symbols.
5. **Save**.

Existing users keep current passwords until they change them. No app code change required unless you want custom `WeakPasswordError` copy on `/login`.

**Checkbox when done:** [ ] Leaked-password protection enabled in Dashboard

## Post-push smoke (owner)

1. Sign in; `/library?q=test` keyword search (trigram indexes).
2. `/invoicing` → generate invoice number (RPC).
3. `/library/search-passage` with a passage query (RPC).
4. Edit a book field → confirm new `audit_log` row in `/settings/audit-log`.
5. Re-run **Security Advisor** — expect:
   - Cleared: `function_search_path_mutable` (5), `anon_security_definer_function_executable` (11), `extension_in_public` (1).
   - Remaining: `authenticated_security_definer_function_executable` (accepted), `auth_leaked_password_protection` until Dashboard toggle on.

## Accepted Advisor warnings (intentional)

| Lint | Why it stays |
|------|----------------|
| `authenticated_security_definer_function_executable` | `app_is_*` used in RLS; merge + invoice + search RPCs called from SvelteKit with user JWT |
| `auth_leaked_password_protection` | Until owner enables in Dashboard (above) |

## Carry-forward updates

- [ ] Owner: enable leaked-password protection in Dashboard
- [ ] Owner: post-push smoke + Security Advisor re-run
- [ ] `PLAN.md` optional one-line under Supabase workflow
