# 039 — PostgREST API grants (Supabase #45329)

**Date:** 2026-05-28  
**Module:** platform / supabase  
**Tracker:** n/a — platform hygiene

## Built

- Decision runbook (this file) with **manual Studio steps** and **SQL audit queries**.
- Migration `20260528120000_postgrest_api_grants_explicit.sql` — idempotent `GRANT`s on all `public` tables + sequences (safe on prod that already has default privileges).
- `.cursor/rules/db-changes.mdc` — API grant checklist for every new table.

## Decided

- **Explicit table `GRANT`s in migrations** going forward (portable across project creation dates and the Oct 2026 default flip). Rejected relying solely on Dashboard “Automatically expose new tables” — toggle does not retroactively fix tables and is easy to miss on new projects.
- **Keep granting `anon` SELECT** on app tables for parity with legacy Supabase defaults; RLS still gates rows. ppp is login-gated in practice, but anon key + JWT is how the client works pre-session.
- **No `pg_graphql` work** — app does not call GraphQL; skip enabling the extension unless that changes.

## Schema changes

- `20260528120000_postgrest_api_grants_explicit.sql` — grants only, no DDL.

## Manual steps (owner — do once, ~15 min)

### 1. Confirm project vintage

In [Supabase Dashboard](https://supabase.com/dashboard/project/objtrdmmqlndtfddtzan/settings/general) → **General** → note **Created at**.

| Created | Meaning |
|--------|---------|
| Before **2026-05-30** | Prod likely still has auto-expose **on** for new tables until **2026-10-30** platform flip |
| On/after **2026-05-30** | New tables need explicit grants **now** (ship migration below immediately) |

### 2. Check the exposure toggle

**Database** → **Settings** (or **Data API** settings, depending on Studio layout) → **“Automatically expose new tables and functions”**.

| Your choice | When to use |
|-------------|-------------|
| **Leave ON** (recommended until grants migration ships) | Matches today’s behavior; less urgent until Oct 2026 |
| **Turn OFF** | Stricter surface; **every** new table migration **must** include `GRANT`s (checklist in `db-changes.mdc`) |

**Recorded 2026-09-26 — the toggle is ON** (left at the default, i.e. the recommended row above).
Verified from database state rather than the dashboard: `pg_default_acl` on schema `public` carries
table-level default grants of `arwdDxtm` to `anon`, `authenticated` and `service_role`, from both the
`postgres` and `supabase_admin` grantors (sequences and functions likewise). If those rows ever
disappear, either the toggle was turned off or the 2026-10-30 platform flip has landed.

```sql
-- Re-check the toggle without opening Studio:
SELECT pg_get_userbyid(d.defaclrole) AS grantor, d.defaclobjtype AS objtype, d.defaclacl
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public';
```

### 3. Run Security Advisor

**Database** → **Security Advisor** (or Advisors). Look for findings like tables with RLS but **no API role grants**. Fix list should shrink after applying the grants migration.

### 4. Audit missing grants (SQL Editor)

Run on **prod** (read-only audit):

```sql
-- Tables in public with no SELECT for authenticated (should return 0 rows after migration)
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = t.tablename
      AND g.grantee = 'authenticated'
      AND g.privilege_type = 'SELECT'
  )
ORDER BY 1;
```

Spot-check the two tables added without grants in their create migrations:

```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('publishers', 'library_ocr_usage')
  AND grantee IN ('authenticated', 'service_role')
ORDER BY 1, 2, 3;
```

### 5. Apply repo migration (when ready)

```bash
npm run supabase:db:push:dry   # should list 20260528120000_postgrest_api_grants_explicit.sql
npm run supabase:db:push
```

No `gen-types` needed (grants only).

### 6. Smoke-test high-risk surfaces

After push:

1. **Library list** — `/library` loads books (exercises `publishers` embed + core tables).
2. **Publisher settings** — `/settings/library/publishers` list + edit.
3. **OCR** — one scripture OCR on a book (exercises `library_ocr_usage` via `ocr_scripture_refs` service role).

If anything 403s with `42501 permission denied for table`, re-run the audit query in step 4.

### 7. New Supabase projects (future)

If you ever create a **second** project (staging, fork):

- Run `npm run supabase:link` + full migration push.
- Assume auto-expose is **OFF** if created after 2026-05-30.
- Do **not** rely on `supabase start` in this repo to catch grant gaps.

### 8. Optional: `pg_graphql`

Only if you add GraphQL clients later:

```sql
CREATE EXTENSION IF NOT EXISTS pg_graphql;
```

Not required for ppp today.

## Verification pass — 2026-09-26

Run against prod (`objtrdmmqlndtfddtzan`) ahead of the 2026-10-30 flip. Read-only. The Supabase MCP
connector has no access to this project (it is scoped to the work org), so the queries went over
`LIBRARY_DST_DATABASE_URL`.

| Check | Result |
|-------|--------|
| `20260528120000` applied on remote | ✅ row present in `supabase_migrations.schema_migrations` |
| Local ↔ remote migration parity since 2026-05-28 | ✅ 107 files, 107 applied, no drift either direction |
| Tables where `anon` **and** `authenticated` **and** `service_role` all lack SELECT | ✅ **0** of 48 public tables |
| Tables lacking SELECT for **any one** of the three roles | ✅ 0 |
| Tables where `authenticated` lacks INSERT | ✅ 0 |
| Views / matviews lacking `authenticated` SELECT | ✅ 0 |
| Every live public table traces to a `CREATE TABLE` in a migration | ✅ 48/48 — nothing created in Studio |
| RLS enabled on every public table | ✅ 48/48 (`library_ocr_usage` has 0 policies **by design** — service-role-only counter) |
| Create-table migrations since 2026-05-28 carrying `GRANT`s | ⚠️ all 10 carry one, but **2 were incomplete** — below |

### The gap: Projects v1 granted to `authenticated` only

`20260603170000_ppp_projects_v1.sql` (`projects`, `project_updates`, `project_links`) and
`20260604030000_ppp_project_tasks_myn.sql` (`project_tasks`) omitted `service_role` and the `anon`
SELECT. Ironically the first one carries the comment *"footgun #8 — explicit, don't rely on Dashboard
auto-expose"* while doing exactly that for two of the three roles.

Prod looks clean only because those grants came from the schema default ACL. Proof: both migrations
ran **after** 20260528120000, so the bulk-grants migration never touched their tables, and the tables'
`relacl` reads `anon=arwdDxtm/postgres` — the full default-privilege set, not the SELECT-only that the
convention produces.

Fixed by `20260926111500_projects_grants_backfill_service_role_anon.sql`. No-op on prod; it exists so
a replay onto a fresh project survives the flip.

### Footgun: grant-audit queries over `pg_tables` are plan-dependent

`has_table_privilege(role, format('public.%I', tablename), …)` filtered on `pg_tables` intermittently
fails with `relation "public.schema_migrations" does not exist`. `pg_tables` is a view, and the planner
may evaluate the function before the `schemaname = 'public'` qualifier — and `schema_migrations` exists
in `auth`, `realtime` and `supabase_migrations`, just not in `public`. It is plan-dependent, so the same
query can pass once and fail the next time. **Audit over `pg_class` with the OID overload instead:**

```sql
SELECT count(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT has_table_privilege('anon',          c.oid, 'SELECT')
  AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
  AND NOT has_table_privilege('service_role',  c.oid, 'SELECT');
```

(The `information_schema.role_table_grants` form in step 4 above is not affected — it never resolves a
relation name — but it only shows grants where the current role is grantor or grantee, so run it as
`postgres`.)

## Repo follow-ups (planned)

| Item | Status |
|------|--------|
| Bulk grants migration | ✅ `20260528120000_postgrest_api_grants_explicit.sql` |
| `db-changes.mdc` grant checklist | ✅ |
| `supabase/README.md` pointer | ✅ |
| Per-table grants inside **future** `CREATE TABLE` migrations | Ongoing convention |
| October 2026 re-check before platform flip | ✅ Verification pass **2026-09-26** (section above); re-check once more after 10-30 |
| Projects v1 grant backfill | ✅ `20260926111500_projects_grants_backfill_service_role_anon.sql` |

## Open questions surfaced

- ~~Exact Oct 30, 2026 behavior on **existing** projects (revoke existing grants vs. only change defaults for new tables).~~ **Answered 2026-09-26 by the verification pass.** Grants are materialized per-table in `pg_class.relacl` at creation time; `pg_default_acl` only seeds them. Removing or changing the default ACL cannot retroactively revoke what is already in `relacl`, so the flip **cannot break existing tables**. The exposure is (a) **new** tables and (b) — until the backfill migration above — a **replay onto a fresh project**, i.e. the staging fork in step 7. Still worth re-reading the [Supabase changelog](https://supabase.com/changelog) that week.

## Surprises (read these before the next session)

- **`42501` can look like empty data** — `const { data } = await supabase.from('x').select()` with no `error` check returns `null` / `[]`.
- **Hosted-only workflow** — `supabase start` / CI local stack still use legacy auto-grant; won’t reproduce prod after May 30 on **new** projects.

## Carry-forward updates

- [x] `db-changes.mdc` updated
- [x] `AGENTS.md` inventory updated — API-grants bullet under **Scripts › Supabase workflow** (2026-09-26)
- [x] `PLAN.md` — note under **Supabase workflow**, plus the backfill migration in **Projects migrations** (2026-09-26)
