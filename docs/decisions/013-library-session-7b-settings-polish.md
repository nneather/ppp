# 013 — Library Session 7b: series, ancient texts merge, translators, permissions RLS

**Date:** 2026-05-02  
**Module:** library  
**Tracker session:** Session 7 (remaining rows)

## Built

- `/settings/library/series` — list, live book counts, edit dialog, soft-delete when zero books (server-enforced count).
- `/settings/library/ancient-texts` — owner CRUD, coverage counts, owner merge with typed confirmation of canonical name; `depends('app:library:ancient_texts')` on book detail load.
- Postgres: `ancient_texts.deleted_at`, `merged_into_id`, partial unique on live `canonical_name`, `library_merge_ancient_texts` RPC, `write_audit_log` branches (merge soft-delete non-revertible; `book_ancient_coverage` UPDATE non-revertible when `set_config('app.library_merge_ancient','true',true)`), `ancient_texts` SELECT policy (owner sees merged-away; others live rows only).
- Translator data migration (TDNT Bromiley + Joüon/Muraoka) + `migrationOverrides.ts` aligned for future imports.
- `/settings/permissions` (owner-only): viewer × module matrix (`library`, `invoicing`, `calendar`, `projects`); `user_permissions` upsert.
- RLS: `app_module_access_level`, `app_has_module_read`; library SELECT policies gated; junction `FOR SELECT` policies for read viewers; `books_viewer_read_update` + trigger allowing **only** `reading_status` (+`updated_at`) edits for library read viewers.
- Audit: `ancient_texts` soft-revert whitelist; `user_permissions` in library audit filter + `entityLabelFor`; settings hub card for permissions.

## Decided

- **Read vs write on books:** Read-only library viewers may change `reading_status` only (jsonb-diff guard trigger); all other columns unchanged. Write unchanged (`app_is_viewer_writer('library')`).
- **Non-library module toggles:** Persist `user_permissions` only; invoicing RLS remains owner-only until a future session wires helpers.
- **Ancient texts soft-delete (non-merge):** Blocked when any `book_ancient_coverage` exists (series-style gate).

## Schema changes

- `20260502140000_library_merge_ancient_texts.sql` — merge columns + RPC + audit + select policy refresh.
- `20260502145000_enforce_books_viewer_columns_migration_bypass.sql` — B1/B2 trigger bypass when `auth.uid()` is null (migrations).
- `20260502150000_library_translator_migration.sql` — data backfill.
- `20260502160000_library_module_read_rls.sql` — module read helpers + library RLS + read-status guard trigger.

## New components / patterns added

- `src/lib/library/server/series-settings-actions.ts`, `series-settings-book-counts.ts`
- `src/lib/library/server/ancient-texts-settings-actions.ts`, `ancient-texts-settings-book-counts.ts`
- `src/lib/library/server/permissions-actions.ts`
- `loadProfileRole` exported from `people-settings-actions.ts` for reuse

## Open questions surfaced

- Owner-only **library** access: owner has no `user_permissions` row — `app_module_access_level` returns `owner` from `profiles.role`, so owners are unaffected.
- Mobile screenshots for new surfaces: capture locally after deploy (series, ancient-texts, permissions).
- **`library-scripture-images` storage RLS** still uses `app_is_viewer_writer('library')` for SELECT; library **read** viewers may need a follow-up migration if they should load signed scripture images without write access.

## Surprises

- Remote `supabase gen types` ran before migrations applied locally; `database.ts` patched manually for `ancient_texts` merge columns + new RPC/helpers until prod reflects migrations.
- **`enforce_books_viewer_columns` during `db push`:** `auth.uid()` is null in the migration session, so `app_is_owner()` was false and `UPDATE books.personal_notes` in the translator migration failed until the trigger bypassed when `auth.uid() IS NULL`. Shipped as [`20260502145000_enforce_books_viewer_columns_migration_bypass.sql`](../supabase/migrations/20260502145000_enforce_books_viewer_columns_migration_bypass.sql) (timestamp **before** `20260502150000` so it applies first).
- **PostgreSQL `UPDATE … FROM`:** the Joüon/Muraoka `book_authors` updates could not reference the target alias `ba` inside `INNER JOIN … ON pm.id = ba.person_id`; rewrote as comma-`FROM` + `WHERE` in [`20260502150000_library_translator_migration.sql`](../supabase/migrations/20260502150000_library_translator_migration.sql).

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [ ] components.mdc — no new shared components
- [x] library-module.mdc — Session 7b settings / permissions note
- [ ] new env vars — none
- [x] tracker Session 7 rows + build notes
