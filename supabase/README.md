# Supabase — ppp

This folder is the **single source of truth** for the database schema and Edge Functions.

For a **go-live checklist**, hosting env vars, and why `db push` uses `link` first, see [`docs/Supabase_deployment_and_go_live.md`](../docs/Supabase_deployment_and_go_live.md).

## Hosted project (prod only)

There is **one** Supabase project. The project ref lives in `.env` (gitignored):

```
SUPABASE_REF=objtrdmmqlndtfddtzan
```

The Svelte app reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` from **`.env.local`** (gitignored). Those **must** match the same project as `SUPABASE_REF` and the CLI link, or writes will silently hit the wrong database.

### Sanity check (run often)

```bash
npm run supabase:doctor
```

Prints the CLI-linked ref, the ref parsed from `PUBLIC_SUPABASE_URL`, and `SUPABASE_REF`. Exits with an error if they differ — then run:

```bash
npm run supabase:link
```

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
| `npm run supabase:deploy-functions` | Deploy `generate-invoice-pdf`, `send-invoice`, and `ocr_scripture_refs` |

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
- **Delete old staging project** (after prod works for you): [Staging settings](https://supabase.com/dashboard/project/nvhqzcpscgbbetrwkhuv/settings/general) → scroll to **Delete project** (only when you no longer need that project).

## Edge Functions

Functions live under `supabase/functions/`:

| Function               | Purpose                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-invoice-pdf` | Authenticated owner only. Loads invoice + line items + client, builds a PDF with `pdf-lib`, returns `{ pdf: "<base64>" }`.                            |
| `send-invoice`         | Authenticated owner only. Sends the PDF via [Resend](https://resend.com) to the client’s email. Expects `{ invoice_id, pdf_base64, custom_message }`. |
| `ocr_scripture_refs`   | Library: user JWT + `GET /auth/v1/user`; downloads `library-scripture-images` via service role; calls **Anthropic Messages API** (vision); returns `{ rawText, candidates }` — never writes DB rows. |

### Secrets (set on the hosted project)

Configure in the Supabase Dashboard → **Project Settings → Edge Functions → Secrets**, or locally:

```bash
supabase secrets set \
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

- **`ANTHROPIC_API_KEY`** — Required for scripture OCR. Mirror in `.env.local` only if you run `supabase functions serve` locally.
- **`ANTHROPIC_OCR_MODEL`** — Optional override for the Claude model id (vision-capable Sonnet family).

- **`RESEND_API_KEY`** — Required for `send-invoice`. **Production:** the function uses a verified-domain `from` / `reply_to` baked into [`send-invoice/index.ts`](./functions/send-invoice/index.ts) (`npneathery.com`). For a **non-verified** Resend setup or scratch projects, you would change that code to `onboarding@resend.dev` (sandbox) or another verified domain.
- **`SENDER_*`** — Used on the PDF letterhead (`generate-invoice-pdf`). Optional lines can be omitted. If unset, defaults match N. P. Neathery Consulting (name, tagline, address, phone). `SENDER_EMAIL` is optional on the PDF. Override **`INVOICE_SERVICE_LABEL`**, **`INVOICE_PAYABLE_TO`**, **`INVOICE_TERMS`**, or **`INVOICE_THANK_YOU`** to customize the “FOR” line and footer text.
- **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**, and **`SUPABASE_SERVICE_ROLE_KEY`** are injected automatically in Edge Functions; do not set those keys manually.

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
4. **Watch logs:** Dashboard → **Edge Functions** → select a function → **Logs** if `invoke` returns a non-2xx status.

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
