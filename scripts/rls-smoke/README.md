# RLS smoke (ppp-staging)

Agent-runnable PostgREST / RPC checks for library RLS. **Never loads prod `.env.local`.**

## Setup (one time)

1. Copy [`.env.staging.example`](../../.env.staging.example) → `.env.staging` and set `SUPABASE_REF` for **ppp-staging** (Dashboard → Settings → General).
2. Create `.env.staging.local` (gitignored):

```bash
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Owner on staging (your account or dedicated rls-test-owner@…)
RLS_TEST_OWNER_EMAIL=...
RLS_TEST_OWNER_PASSWORD=...

# Created/updated by ensure-users (pick passwords you store here only)
RLS_TEST_VIEWER_WRITE_EMAIL=rls-test-viewer-write@example.com
RLS_TEST_VIEWER_WRITE_PASSWORD=...
RLS_TEST_VIEWER_READ_EMAIL=rls-test-viewer-read@example.com
RLS_TEST_VIEWER_READ_PASSWORD=...
```

3. Bring staging schema to prod parity:

```bash
npm run supabase:db:push:dry:staging
npm run supabase:db:push:staging
```

4. Bootstrap auth users:

```bash
npm run test:rls:ensure-users
```

## Run

```bash
npm run test:rls              # full library matrix + cleanup
npm run test:rls -- --dry-run # sign-in + book count parity only
npm run supabase:doctor:staging
```

Exit code `0` = pass, `1` = failure, `2` = missing env.

## Tracker mapping

| Script case | Tracker acceptance |
|-------------|-------------------|
| 01–05, 07–09 | Session 1 / 7 viewer DB rows |
| 10–12 | Session 7 read viewer + Session 3 count parity |
| 13–14 | Session 2 scripture + passage search |
| 15 | Import footgun (service-role vs B1/B2) |

**Still manual:** [library-trip-qa-runbook.md](../../docs/library-trip-qa-runbook.md) §A (phone), §B (SvelteKit `403` routes).

## Notes

- Rows use title/last_name prefix `rls-smoke-`; cleaned via service role after each run.
- Case **06** documents whether viewer soft-delete (`deleted_at` UPDATE) is allowed by RLS.
- Tracker “viewer cannot UPDATE owner’s scripture rows” may **not** match DB policy today; case 14 asserts insert succeeds (current policy).
