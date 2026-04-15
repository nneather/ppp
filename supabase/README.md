# Supabase — ppp

This folder is the **single source of truth** for the database schema.

## Migrations

All schema changes live in `supabase/migrations/` as numbered SQL files:

- `00000000000000_baseline.sql` — full schema: tables, indexes, functions, triggers, RLS policies
- Future changes: `supabase migration new <name>`, edit the generated file, then `supabase db push`

## Seed data

`supabase/seed.sql` runs automatically on `supabase db reset`. It inserts starter clients and rates.

## Local stack (Docker required)

Local commands (`supabase start`, `supabase db reset`, `supabase migration up`) need **Docker Desktop** (or Docker Engine) running so the CLI can talk to `unix:///var/run/docker.sock`. Without Docker, `db reset` fails with “Cannot connect to the Docker daemon…”. Without a running stack, `migration up` fails with **connection refused** on `127.0.0.1:54322` because Postgres is not up yet.

**Recovery order**

1. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) if needed, then start it and wait until it is fully running.
2. From the repo root: `npm run supabase:start` (or `supabase start`) and wait until services are healthy.
3. Then either:
   - **Clean DB + run all migrations + seed:** `npm run supabase:db:reset` (or `supabase db reset`)
   - **Apply only pending migrations** (keeps existing local data): `npm run supabase:migration:up` (or `supabase migration up`)

If `supabase start` still fails, run `supabase start --debug` and check Docker Desktop **Settings → Resources** (CPU, memory, disk).

**Without local Docker:** use a [hosted](https://supabase.com/dashboard) project, `supabase link`, and apply schema with `supabase db push` or the SQL editor — do not expect `127.0.0.1:54322` to work until the local stack exists.

## Workflow

```
# Link to remote (first time)
supabase link

# Create a new migration
supabase migration new add_foo_column

# Push migrations to remote
supabase db push

# Reproduce the full DB locally (requires Docker)
npm run supabase:start
npm run supabase:db:reset
```

## Edge Functions (invoicing — Session 4)

Functions live under `supabase/functions/`:

| Function               | Purpose                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-invoice-pdf` | Authenticated owner only. Loads invoice + line items + client, builds a PDF with `pdf-lib`, returns `{ pdf: "<base64>" }`.                            |
| `send-invoice`         | Authenticated owner only. Sends the PDF via [Resend](https://resend.com) to the client’s email. Expects `{ invoice_id, pdf_base64, custom_message }`. |

### Secrets (set on the hosted project)

Configure in the Supabase Dashboard → **Project Settings → Edge Functions → Secrets**, or locally:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxx \
  SENDER_NAME="Your name or business" \
  SENDER_EMAIL="you@example.com" \
  SENDER_ADDRESS_LINE_1="123 Main St" \
  SENDER_ADDRESS_LINE_2="City, ST 00000" \
  SENDER_TAGLINE="Your tagline"
  SENDER_PHONE="+1 555 000 0000"
```

- **`RESEND_API_KEY`** — Required for `send-invoice`. For development you can use `onboarding@resend.dev` as the sender address (no domain verification).
- **`SENDER_*`** — Used on the PDF letterhead (`generate-invoice-pdf`). Optional lines can be omitted. If unset, defaults match N. P. Neathery Consulting (name, tagline, address, phone). `SENDER_EMAIL` is optional on the PDF. Override **`INVOICE_SERVICE_LABEL`**, **`INVOICE_PAYABLE_TO`**, **`INVOICE_TERMS`**, or **`INVOICE_THANK_YOU`** to customize the “FOR” line and footer text.
- **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** are injected automatically in Edge Functions; do not set them manually.

### PDF layout looks unchanged after code changes

The Svelte app calls **`functions.invoke('generate-invoice-pdf', …)`** on the Supabase project URL from your env (usually **hosted** `*.supabase.co`). The browser does **not** run the TypeScript in `supabase/functions/` — only whatever was **last deployed** to that project runs.

After editing [`supabase/functions/generate-invoice-pdf/index.ts`](./functions/generate-invoice-pdf/index.ts), redeploy from the repo root:

```bash
npm run supabase:deploy-pdf
# same as: supabase functions deploy generate-invoice-pdf

npm run supabase:send-invoice
# same as: supabase functions deploy send-invoice

npm run supabase:deploy-functions
# deploys both PDF and send-invoice functions
```

If you use **local** Supabase (`supabase start` + `PUBLIC_SUPABASE_URL` pointing at `http://127.0.0.1:54321`), Edge Functions hot-reload from disk; if you still see stale output, run `supabase stop` then `supabase start`.

### Deploy

```bash
npm run supabase:deploy-functions
# or individually:
npm run supabase:deploy-pdf
npm run supabase:send-invoice
```

### Deployment verification (before testing in the app)

Run through this checklist once per environment (hosted project):

1. **Confirm both functions appear** in the Supabase Dashboard → **Edge Functions** (each should show as deployed / active).
2. **Set secrets** with `supabase secrets set ...` (or Dashboard → **Project Settings** → **Edge Functions** → **Secrets**) — at minimum `RESEND_API_KEY` and `SENDER_*` as needed.
3. **Resend sandbox:** emails from `onboarding@resend.dev` may only reach **your Resend account email** until you verify your own domain. Use **Send test to myself** on the invoice detail page to verify the pipeline before sending to a client’s address.
4. **Watch logs:** Dashboard → **Edge Functions** → select a function → **Logs** if `invoke` returns a non-2xx status.

### Local testing

```bash
npm run supabase:start
supabase functions serve --env-file ./supabase/.env.local
```

Create `supabase/.env.local` (gitignored) with the same variables as above for local serves.

## Troubleshooting

### `Cannot connect to the Docker daemon` (`supabase db reset`)

Docker is not running or not installed. Start **Docker Desktop**, confirm `docker info` works in a terminal, then run `npm run supabase:start` before `npm run supabase:db:reset`.

### `Unsupported JWT algorithm ES256` (PDF download / Edge Functions)

Hosted projects may issue **ES256** access tokens. Invoicing functions use **`verify_jwt = false`** in [`config.toml`](./config.toml) and validate the caller with **`GET /auth/v1/user`** inside the function so Auth verifies the token. After pulling these changes, **redeploy** both functions (`npm run supabase:deploy-functions`).

### `connect: connection refused` on `127.0.0.1:54322` (`supabase migration up`)

The local Supabase stack is not running (Postgres listens on `54322` only after `supabase start`). Run `npm run supabase:start` first, then `npm run supabase:migration:up`.

### `record "new" has no field "status"` on time_entries

The audit trigger `write_audit_log()` must guard `NEW.status` / `OLD.status` behind `IF TG_TABLE_NAME = 'invoices'` using a **nested IF** (not a compound AND). The baseline migration already has the correct pattern. If this error reappears, check the function body:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'write_audit_log' AND pronamespace = 'public'::regnamespace;
```

Diagnostic queries: [`sql/inspect_status_triggers.sql`](../sql/inspect_status_triggers.sql)
