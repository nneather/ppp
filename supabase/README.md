# Supabase — ppp

This folder is the **single source of truth** for the database schema.

## Migrations

All schema changes live in `supabase/migrations/` as numbered SQL files:

- `00000000000000_baseline.sql` — full schema: tables, indexes, functions, triggers, RLS policies
- Future changes: `supabase migration new <name>`, edit the generated file, then `supabase db push`

## Seed data

`supabase/seed.sql` runs automatically on `supabase db reset`. It inserts starter clients and rates.

## Workflow

```
# Link to remote (first time)
supabase link

# Create a new migration
supabase migration new add_foo_column

# Push migrations to remote
supabase db push

# Reproduce the full DB locally (requires Docker)
supabase start
supabase db reset
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
  SENDER_PHONE="+1 555 000 0000"
```

- **`RESEND_API_KEY`** — Required for `send-invoice`. For development you can use `onboarding@resend.dev` as the sender address (no domain verification).
- **`SENDER_*`** — Used on the PDF letterhead (`generate-invoice-pdf`). Optional lines can be omitted; `SENDER_NAME` defaults to `"Sender"` if unset.
- **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** are injected automatically in Edge Functions; do not set them manually.

### Deploy

```bash
supabase functions deploy generate-invoice-pdf
supabase functions deploy send-invoice
```

### Deployment verification (before testing in the app)

Run through this checklist once per environment (hosted project):

1. **Confirm both functions appear** in the Supabase Dashboard → **Edge Functions** (each should show as deployed / active).
2. **Set secrets** with `supabase secrets set ...` (or Dashboard → **Project Settings** → **Edge Functions** → **Secrets**) — at minimum `RESEND_API_KEY` and `SENDER_*` as needed.
3. **Resend sandbox:** emails from `onboarding@resend.dev` may only reach **your Resend account email** until you verify your own domain. Use **Send test to myself** on the invoice detail page to verify the pipeline before sending to a client’s address.
4. **Watch logs:** Dashboard → **Edge Functions** → select a function → **Logs** if `invoke` returns a non-2xx status.

### Local testing

```bash
supabase start
supabase functions serve --env-file ./supabase/.env.local
```

Create `supabase/.env.local` (gitignored) with the same variables as above for local serves.

## Troubleshooting

### `record "new" has no field "status"` on time_entries

The audit trigger `write_audit_log()` must guard `NEW.status` / `OLD.status` behind `IF TG_TABLE_NAME = 'invoices'` using a **nested IF** (not a compound AND). The baseline migration already has the correct pattern. If this error reappears, check the function body:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'write_audit_log' AND pronamespace = 'public'::regnamespace;
```

Diagnostic queries: [`sql/inspect_status_triggers.sql`](../sql/inspect_status_triggers.sql)
