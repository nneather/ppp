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

## Troubleshooting

### `record "new" has no field "status"` on time_entries

The audit trigger `write_audit_log()` must guard `NEW.status` / `OLD.status` behind `IF TG_TABLE_NAME = 'invoices'` using a **nested IF** (not a compound AND). The baseline migration already has the correct pattern. If this error reappears, check the function body:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'write_audit_log' AND pronamespace = 'public'::regnamespace;
```

Diagnostic queries: [`sql/inspect_status_triggers.sql`](../sql/inspect_status_triggers.sql)
