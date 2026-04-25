# Supabase deployment and go-live checklist

This document captures **operational steps** that are easy to forget: env alignment, shipping schema and Edge Functions, and verifying production. It complements the technical detail in [`supabase/README.md`](../supabase/README.md).

## How this repo targets Supabase

- **CLI and migrations** use a gitignored [`.env`](../.env) at the repo root with `SUPABASE_REF=<project_reference_id>`. Scripts run `supabase link --project-ref $SUPABASE_REF` before `db push` because **`supabase db push` does not accept `--project-ref`** (that flag exists on REST-backed commands such as `functions deploy`, not on Postgres-direct commands). Link-first avoids `unknown flag: --project-ref` and keeps the correct project as the push target.
- **The Svelte app** reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from **`.env.local`** (gitignored). Those **must** match the same hosted project you intend the browser to use, or reads/writes will hit the wrong database.
- **Sanity check:** run often after changing env files or switching machines:

```bash
npm run supabase:doctor
```

It compares the CLI-linked ref, the ref parsed from `PUBLIC_SUPABASE_URL`, and `SUPABASE_REF`. If anything disagrees, run `npm run supabase:link` and fix `.env.local`.

## One-time setup (new machine or new clone)

1. Copy `.env` and `.env.local` from a secure store (they are not in git).
2. `npm install`
3. `npm run supabase:link` — enter the database password when prompted the first time per project; macOS stores it in the keychain so later `db push` runs are non-interactive.
4. `npm run supabase:doctor` — must pass before you trust local dev.

## Ship a schema or function change

```bash
# 1. Create and edit the migration
supabase migration new describe_your_change

# 2. Dry run (lists pending migrations; does not write)
npm run supabase:ship

# 3. If output looks right, apply migrations + deploy both Edge Functions
npm run supabase:ship:apply
```

Granular commands (from `package.json`):

| Script | Purpose |
|--------|---------|
| `npm run supabase:link` | Link CLI to `SUPABASE_REF` |
| `npm run supabase:db:push:dry` | Dry-run migrations against linked project |
| `npm run supabase:db:push` | Push pending migrations |
| `npm run supabase:deploy-functions` | Deploy `generate-invoice-pdf` and `send-invoice` |
| `npm run supabase:ship` | `check` + dry-run push + reminder to run `ship:apply` |
| `npm run supabase:ship:apply` | `check` + push + deploy functions |

## Go-live and ongoing checklist

Use this before sending real client traffic (invoicing) and after any infra change.

### 1. Repo and CLI

- [ ] `SUPABASE_REF` in `.env` points at **production** (the project you want migrations and function deploys to hit).
- [ ] `npm run supabase:doctor` passes.
- [ ] `npm run supabase:db:push:dry` reports either pending migrations you expect, or **Remote database is up to date.**

### 2. Hosted app environment (Vercel / Netlify / etc.)

Set **per deployment environment** (Production vs Preview if you use both):

| Variable | Notes |
|----------|--------|
| `PUBLIC_SUPABASE_URL` | `https://<project_ref>.supabase.co` for that environment’s project |
| `PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Project Settings → API → anon (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same API page → service_role — **server-only**, never exposed to the browser |

Production deploy must use **production** project URL and keys. Preview deploys may use a separate Supabase project if you maintain one; then Preview env vars point at that project’s URL and keys.

### 3. Edge Function secrets (hosted project)

Set on the **same** project the app calls (usually production for prod deploy):

- `RESEND_API_KEY` — required for `send-invoice`.
- `SENDER_NAME`, `SENDER_EMAIL`, `SENDER_ADDRESS_LINE_1`, `SENDER_ADDRESS_LINE_2`, `SENDER_TAGLINE`, `SENDER_PHONE` — PDF letterhead (`generate-invoice-pdf`).

Use the Dashboard (Edge Functions → Secrets) or:

```bash
supabase secrets set --project-ref <PROJECT_REF> \
  RESEND_API_KEY=re_... \
  SENDER_NAME="..." \
  ...
```

Use a **Resend test/sandbox key** on any non-production Supabase project so you cannot accidentally email real clients from staging.

### 4. Smoke test from the real deploy

- Deploy the app to production (or your pre-prod URL that uses production env vars).
- From an invoice detail page, use **Send test to myself** (or equivalent).
- Confirm PDF content and email delivery. If something fails, Dashboard → Edge Functions → Logs for that project.

### 5. After migrations land on production

- [ ] `npm run supabase:db:push:dry` shows **up to date** for `SUPABASE_REF`.
- [ ] Both Edge Functions show as deployed in the Dashboard for that project.

## Troubleshooting snippets

**`unknown flag: --project-ref` on `db push`**  
Expected: `db push` never supported that flag. This repo uses `link --project-ref` then `db push` inside the npm scripts.

**`failed to parse connection string` when using `--db-url`**  
The password in the URL must be **percent-encoded** (e.g. `@` → `%40`). Bracket placeholders like `[YOUR-PASSWORD]` are invalid. Prefer `supabase link` + keychain over hand-built URLs.

**Invoicing “saves” but data does not persist**  
Run `npm run supabase:doctor`. See **First-time account** in `supabase/README.md` (owner `profiles` row).

**PDF or email unchanged after editing function code**  
Redeploy: `npm run supabase:deploy-functions`. The browser runs whatever was last deployed to the project URL in env.

## Optional: old staging project

If you previously used a separate Supabase project for experiments, delete it from the Dashboard only when you no longer need it. See the staging delete note in [`supabase/README.md`](../supabase/README.md) (Dashboard link there).

## Related files

- [`supabase/README.md`](../supabase/README.md) — migrations, Edge Functions, secrets, JWT / audit troubleshooting.
- [`package.json`](../package.json) — `supabase:*` npm scripts.
- [`scripts/supabase-doctor.sh`](../scripts/supabase-doctor.sh) — env alignment check used by `npm run supabase:doctor`.
