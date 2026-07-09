# Supabase — ppp

This folder is the **single source of truth** for the database schema and Edge Functions.

For a **go-live checklist**, hosting env vars, and why `db push` uses `link` first, see [`docs/Supabase_deployment_and_go_live.md`](../docs/Supabase_deployment_and_go_live.md).

## Hosted projects

| Project | Purpose | Env files |
|---------|---------|-----------|
| **prod** (`objtrdmmqlndtfddtzan`) | App + `ship-library` | `.env` (`SUPABASE_REF`), `.env.local` (`PUBLIC_*`) |
| **ppp-staging** | RLS smoke (`npm run test:rls`) | `.env.staging` (`SUPABASE_REF`), `.env.staging.local` (`PUBLIC_*`, service role, test passwords) |

The Svelte app reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from **`.env.local`** (gitignored). Those **must** match prod `SUPABASE_REF` and the CLI link after prod commands, or writes will silently hit the wrong database.

**RLS smoke never loads `.env.local`** — only `.env.staging` + `.env.staging.local`. See [scripts/rls-smoke/README.md](../scripts/rls-smoke/README.md).

### Sanity check (run often)

**Production:**

```bash
npm run supabase:doctor
```

**Staging (before `test:rls`):**

```bash
npm run supabase:doctor:staging
```

Prints the CLI-linked ref, the ref parsed from `PUBLIC_SUPABASE_URL`, and `SUPABASE_REF`. Exits with an error if they differ — then run `npm run supabase:link` (prod) or `npm run supabase:link:staging`.

## PostgREST API grants (Supabase #45329)

Supabase is changing the default so **new tables are not auto-granted** to API roles (`anon`, `authenticated`, `service_role`). Wrong or missing grants surface as **`42501 permission denied for table`** from the client even when RLS is correct.

**Owner checklist (Studio + one migration):** [docs/decisions/039-supabase-postgrest-api-grants.md](../docs/decisions/039-supabase-postgrest-api-grants.md)

**Repo:** ship explicit `GRANT`s in new migrations (`db-changes.mdc`); apply `20260528120000_postgrest_api_grants_explicit.sql` via `npm run supabase:db:push` when ready.

## Security Advisor hardening

Migrations `20260528140000_*` (search_path + revoke anon RPC), `20260528140100_*` (`pg_trgm` → `extensions`), and `20260528150000_*` (revoke `PUBLIC` EXECUTE on SECURITY DEFINER helpers). Leaked-password protection is **Pro-only** — waived on Free; see [040-security-advisor-hardening.md](../docs/decisions/040-security-advisor-hardening.md).

## Migrations

All schema changes live in `supabase/migrations/` as numbered SQL files:

- `00000000000000_baseline.sql` — full schema: tables, indexes, functions, triggers, RLS policies
- New changes: `supabase migration new <name>`, edit the generated file, then push (below)

### Ship schema + functions

```bash
# 1. Author the migration
supabase migration new add_foo_column
# ...edit supabase/migrations/<timestamp>_add_foo_column.sql...

# 2. Dry run (lists pending migrations; does not write)
npm run supabase:ship

# 3. If the dry-run output looks right, apply migrations + deploy both Edge Functions
npm run supabase:ship:apply
```

Granular commands:

| Command                     | What it does                                              |
| --------------------------- | --------------------------------------------------------- |
| `npm run supabase:link`     | Link CLI to the project in `SUPABASE_REF`                 |
| `npm run supabase:doctor`   | Fail if CLI link / env URL / `SUPABASE_REF` disagree      |
| `npm run supabase:db:push:dry` | Dry-run `db push` (no writes)                        |
| `npm run supabase:db:push`  | Push pending migrations to the linked project             |
| `npm run supabase:db:push:dry:staging` / `db:push:staging` | Same for **ppp-staging** (uses `.env.staging`) |
| `npm run test:rls` | Library RLS matrix on staging ([scripts/rls-smoke/README.md](../scripts/rls-smoke/README.md)) |
| `npm run supabase:deploy-functions` | Deploy `generate-invoice-pdf`, `send-invoice`, `ocr_scripture_refs`, and `email-inbound-task` |

**No local Docker stack** — do not use `supabase start` / `supabase db reset` in this repo; `[db.seed]` is disabled in `config.toml`.

## First-time account (owner profile)

RLS requires a row in `public.profiles` with `role = 'owner'` for the signed-in user. A database trigger (`handle_new_user` on `auth.users`) creates that row on first signup.

1. Ensure `.env.local` points at this project (same ref as `SUPABASE_REF`).
2. Run `npm run dev`, open `/login`, and sign up (e.g. `parker.neathery@gmail.com`).
3. Confirm in Studio (optional): **Authentication → Users** and **Table Editor → profiles** — one row, `role = owner`.

If a user exists in **Authentication** but not in **profiles**, run in the SQL editor:

```sql
INSERT INTO public.profiles (id, email)
SELECT u.id, COALESCE(u.email, '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

To force owner for a specific email:

```sql
UPDATE public.profiles
SET role = 'owner', deleted_at = NULL
WHERE lower(trim(email)) = lower('parker.neathery@gmail.com');
```

## Dashboard (manual)

- **Auth / signups:** [Auth providers](https://supabase.com/dashboard/project/objtrdmmqlndtfddtzan/auth/providers) — ensure Email is enabled; adjust email confirmation as you prefer.
- **ppp-staging:** use the project named `ppp-staging` in your org for `npm run test:rls` — not prod. Copy its ref into `.env.staging` (see `.env.staging.example`).

## Edge Functions

Functions live under `supabase/functions/`:

| Function               | Purpose                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-invoice-pdf` | Authenticated owner only. Loads invoice + line items + client, builds a PDF with `pdf-lib`, returns `{ pdf: "<base64>" }`.                            |
| `send-invoice`         | Authenticated owner only. Sends the PDF via [Resend](https://resend.com) to the client’s email. Expects `{ invoice_id, pdf_base64, custom_message }`. |
| `ocr_scripture_refs`   | Library: user JWT + `GET /auth/v1/user`; downloads `library-scripture-images` via service role; calls **Anthropic Messages API** (vision); returns `{ rawText, candidates }` — never writes DB rows. |
| `email-inbound-task`   | Resend inbound webhook (`email.received`). Svix-signed (no user JWT). Fetches body via Receiving API; inserts a MYN task into the Email Inbox project. |

### Secrets (set on the hosted project)

Configure in the Supabase Dashboard → **Project Settings → Edge Functions → Secrets**, or locally:

```bash
supabase secrets set \
  SITE_URL=https://your-production-domain.com \
  RESEND_API_KEY=re_xxxx \
  SENDER_NAME="Your name or business" \
  SENDER_EMAIL="you@example.com" \
  SENDER_ADDRESS_LINE_1="123 Main St" \
  SENDER_ADDRESS_LINE_2="City, ST 00000" \
  SENDER_TAGLINE="Your tagline" \
  SENDER_PHONE="+1 555 000 0000"
```

**Library OCR (`ocr_scripture_refs`):**

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
# optional — defaults to claude-sonnet-4-6 in code
supabase secrets set ANTHROPIC_OCR_MODEL=claude-sonnet-4-6
```

- **`SITE_URL`** — Production app origin (no trailing slash). Used by all three Edge Functions for CORS allowlisting (`Access-Control-Allow-Origin` only when `Origin` matches). Also accepts optional **`CORS_ALLOWED_ORIGINS`** (comma-separated extra origins) and `*.vercel.app` preview deploys.
- **`ANTHROPIC_API_KEY`** — Required for scripture OCR. Mirror in `.env.local` only if you run `supabase functions serve` locally.
- **`ANTHROPIC_OCR_MODEL`** — Optional override for the Claude model id (vision-capable Sonnet family).

- **`RESEND_API_KEY`** — Required for `send-invoice` and `email-inbound-task` (Receiving API). **Production:** default `from` is `Parker Neathery <invoicing@npneathery.com>` (verified `npneathery.com`); override with optional secret **`INVOICE_RESEND_FROM`** (full Resend `from` string, e.g. `"Display" <addr@yourdomain.com>`). `reply_to` stays `parker@npneathery.com` in code. For a **non-verified** Resend setup, point `INVOICE_RESEND_FROM` at `onboarding@resend.dev` or change the default in [`send-invoice/index.ts`](./functions/send-invoice/index.ts).
- **`SENDER_*`** — Used on the PDF letterhead (`generate-invoice-pdf`). Optional lines can be omitted. If unset, defaults match N. P. Neathery Consulting (name, tagline, address, phone). `SENDER_EMAIL` is optional on the PDF. Override **`INVOICE_SERVICE_LABEL`**, **`INVOICE_PAYABLE_TO`**, **`INVOICE_TERMS`**, or **`INVOICE_THANK_YOU`** to customize the “FOR” line and footer text.
- **`RESEND_WEBHOOK_SECRET`** — Svix signing secret from the Resend webhook for `email.received` → `email-inbound-task`.
- **`INBOUND_TASK_PROJECT_ID`** — UUID of the seeded **Email Inbox** project (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
- **`INBOUND_TASK_ALLOWED_SENDERS`** — Comma-separated allowlist of **forwarder** From addresses (the mailbox you send the forward from, not the original author). Current set: Gmail ×2, 229, Covenant ×2 (optional: `parker@npneathery.com`).
- **`INBOUND_TASK_RECIPIENT`** — Address you forward to (e.g. `tasks@zeneoldai.resend.app` on Resend’s free managed domain, or a custom domain later).
- **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**, and **`SUPABASE_SERVICE_ROLE_KEY`** are injected automatically in Edge Functions; do not set those keys manually.

### Email → MYN task (inbound)

Uses Resend’s free managed receiving domain (`*.resend.app`) — no custom domain / upgrade required. Optional later: branded subdomain like `tasks@in.npneathery.com` by changing `INBOUND_TASK_RECIPIENT` only.

Only messages you **forward** to the recipient address become tasks. The webhook’s `From` must match an allowlisted mailbox (your Gmail / work / seminary addresses). Mail that merely arrives in those inboxes is not auto-captured.

1. In Resend → **Emails → Receiving → ⋮ → Receiving address**, note your `*.resend.app` domain (ours: `zeneoldai.resend.app`). Any local-part works; we use `tasks@…`.
2. Deploy `email-inbound-task` (`npm run supabase:deploy-functions`) — already done for this session.
3. In Resend → Webhooks: URL `https://<project-ref>.supabase.co/functions/v1/email-inbound-task`, event `email.received`; copy the signing secret.
4. Set secrets:

```bash
npx dotenv -e .env -- bash -c 'supabase secrets set \
  RESEND_WEBHOOK_SECRET=whsec_xxxx \
  INBOUND_TASK_PROJECT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  INBOUND_TASK_ALLOWED_SENDERS=parker.neathery@gmail.com,neal.p.neathery@gmail.com,parker.neathery@229project.com,parker.neathery89@covenantseminary.edu,parker.neathery@covenantseminary.edu \
  INBOUND_TASK_RECIPIENT=tasks@zeneoldai.resend.app \
  --project-ref "$SUPABASE_REF"'
```

Optional sixth allowlisted address if you also forward from personal domain mail: append `,parker@npneathery.com` to `INBOUND_TASK_ALLOWED_SENDERS`.

5. Forward a test email from an allowlisted mailbox to `tasks@zeneoldai.resend.app`; it should appear under **Opportunity Now** on `/tasks` in the Email Inbox project.

### PDF layout looks unchanged after code changes

The Svelte app calls **`functions.invoke('generate-invoice-pdf', …)`** on the Supabase project URL from your env. The browser does **not** run the TypeScript in `supabase/functions/` — only whatever was **last deployed** to that project runs.

After editing function code, redeploy:

```bash
npm run supabase:deploy-functions
```

### Deployment verification (before testing in the app)

1. **Confirm all functions appear** in the Supabase Dashboard → **Edge Functions**.
2. **Set secrets** with `supabase secrets set ...` (or Dashboard → **Edge Functions → Secrets**) — at minimum `RESEND_API_KEY` and `SENDER_*` as needed.
3. **Resend / deliverability:** if the repo still pointed at `onboarding@resend.dev`, those emails only reach **your Resend account email** until you verify a domain. This project’s deployed `send-invoice` uses **verified** `npneathery.com` — still use **Send test to myself** after any change to the function, then a real address when ready.
4. **Watch logs:** Dashboard → **Edge Functions** → select a function → **Logs** if `invoke` returns a non-2xx status. After a send, `send-invoice` logs `[send-invoice] Resend from:` with the exact string passed to Resend (compare to **Gmail → Show original → `From:`** and the Resend dashboard message headers).

## Troubleshooting

### `Unsupported JWT algorithm ES256` (PDF download / Edge Functions)

Hosted projects may issue **ES256** access tokens. Edge functions use **`verify_jwt = false`** in [`config.toml`](./config.toml) and validate the caller with **`GET /auth/v1/user`** inside the function. After pulling these changes, **redeploy** all project functions (`npm run supabase:deploy-functions`).

### `record "new" has no field "status"` on time_entries

The audit trigger `write_audit_log()` must guard `NEW.status` / `OLD.status` behind `IF TG_TABLE_NAME = 'invoices'` using a **nested IF** (not a compound AND). The baseline migration already has the correct pattern. If this error reappears, check the function body:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'write_audit_log' AND pronamespace = 'public'::regnamespace;
```

Diagnostic queries: [`sql/inspect_status_triggers.sql`](../sql/inspect_status_triggers.sql)

### Invoicing saves “succeed” but nothing persists

Run `npm run supabase:doctor`. If it passes, check **Table Editor → profiles** for your user id with `role = owner`. See **First-time account** above.
