---
name: ship-library-change
description: Run the library ship gate after schema, types, Turabian, or OCR Edge changes. Use when applying library migrations, regenerating database types, or deploying ocr_scripture_refs.
---

# Ship library change

## When to use

- Any new file in `supabase/migrations/` for library tables
- Changes to `supabase/functions/ocr_scripture_refs/`
- Turabian or loader changes that assume new columns (`work_type`, `library_ocr_usage`, etc.)

## Steps

1. `npm run check`
2. `npm run supabase:db:push:dry` — read diff; confirm RLS + soft delete
3. `npm run ship-library:apply` (or `npm run supabase:db:push && npm run supabase:gen-types && npm run test && npm run supabase:deploy-functions`)
4. File / update `docs/decisions/NNN-*.md` and rotate **PLAN.md** Recent decisions
5. If new reusable UI: update `.cursor/rules/components.mdc`

## Secrets (OCR)

After Edge changes, confirm Supabase secrets: `ANTHROPIC_API_KEY`, optional `ANTHROPIC_OCR_MODEL`, **`SITE_URL`** (production origin for CORS), optional **`CORS_ALLOWED_ORIGINS`** (comma-separated).

## Do not

- Hand-edit `src/lib/types/database.ts` without `npm run supabase:gen-types`
- Use `supabase start` / local Docker for this repo unless owner opts in
