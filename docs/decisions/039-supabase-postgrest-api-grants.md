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

Record what you chose in a personal note; the repo does not store this flag.

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

## Repo follow-ups (planned)

| Item | Status |
|------|--------|
| Bulk grants migration | ✅ `20260528120000_postgrest_api_grants_explicit.sql` |
| `db-changes.mdc` grant checklist | ✅ |
| `supabase/README.md` pointer | ✅ |
| Per-table grants inside **future** `CREATE TABLE` migrations | Ongoing convention |
| October 2026 re-check before platform flip | Calendar reminder |

## Open questions surfaced

- Exact Oct 30, 2026 behavior on **existing** projects (revoke existing grants vs. only change defaults for new tables) — re-read [Supabase changelog](https://supabase.com/changelog) that week; explicit migration is insurance either way.

## Surprises (read these before the next session)

- **`42501` can look like empty data** — `const { data } = await supabase.from('x').select()` with no `error` check returns `null` / `[]`.
- **Hosted-only workflow** — `supabase start` / CI local stack still use legacy auto-grant; won’t reproduce prod after May 30 on **new** projects.

## Carry-forward updates

- [x] `db-changes.mdc` updated
- [ ] `AGENTS.md` inventory updated (optional one-liner under migrations)
- [ ] `PLAN.md` — optional note under Supabase workflow
