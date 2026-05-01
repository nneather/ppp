# Library migrate — localhost → hosted Supabase

Implements **Path B** from the operational plan when your local Postgres has rows that are **not** fully represented by the SQL under [`supabase/seed/`](/supabase/seed/). Paths **A** and **C** do not need this tooling (see below).

## Path A — Data matches git seeds only

Run these **in order** against the live project (SQL editor or `psql`), after migrations:

1. [`supabase/seed/library_seed.sql`](/supabase/seed/library_seed.sql)
2. [`supabase/seed/library_smoke_data.sql`](/supabase/seed/library_smoke_data.sql)
3. Optionally [`supabase/seed/library_scripture_fixture.sql`](/supabase/seed/library_scripture_fixture.sql)

## Path C — Canonical source is the spreadsheet importer

Follow [`scripts/library-import/README.md`](../library-import/README.md) (`POS_OWNER_ID`, `importLibrary.ts --apply`).

## Path B — Programmatic row copy (`migrateLibraryData.ts`)

Copies core **user library** tables from a **source** Postgres (local Supabase) to **destination** (hosted), preserving primary keys while remapping FKs that differ between databases:

| Remap                              | How                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `created_by` → owner on dst        | All non-null `created_by` are set to the destination **owner** `profiles.id` (from `profiles.role = 'owner'`). Nulls stay null.                                                                                                                        |
| `categories`                       | Every `books.primary_category_id` and `book_categories.category_id` mapped by **`slug`** (seeded reference data).                                                                                                                                      |
| `ancient_texts`                    | Every `book_ancient_coverage.ancient_text_id` mapped by **`canonical_name`**.                                                                                                                                                                          |
| `series`                           | Rows referenced by `books.series_id` are matched on prod by `name` + `abbreviation` when possible, else **`name`** only; if still missing on dst, the series row is inserted.                                                                          |
| Storage paths (`source_image_url`) | Paths that start with a **local profile id** (first path segment before `/`) get that segment rewritten to the **destination owner** id — same assumption as migrating scans under prod’s owner prefix. External `http(s)://` URLs are left unchanged. |

**Does not**: copy auth, `profiles`, reference rows (`categories`, `bible_books`, …), Storage objects, or `audit_log`.

### Preconditions

1. **Migrations**: destination schema matches the repo (`npm run supabase:db:push` on prod).
2. **Reference seeds** on prod: run Path A step 1 at minimum so `categories` / `bible_books` / `ancient_texts` rows exist (`library_seed.sql`).
3. **Empty corpus** on destination by default — no non–soft-deleted `books` (`COUNT(*) WHERE deleted_at IS NULL` must be **0**) unless you pass `--allow-non-empty-dst`.

### Env

Two connection strings (**never commit** secrets):

```bash
# Local (from `supabase status`, or Postgres URI on port 54322)
export LIBRARY_SRC_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'

# Hosted — Supabase Dashboard → Database → connection string (use session pooler or direct)
export LIBRARY_DST_DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-...pooler.supabase.com:6543/postgres'
```

Dry-run defaults (no writes on dst):

```bash
npx dotenv -e .env -e .env.local -- tsx scripts/library-migrate-local-to-prod/migrateLibraryData.ts
```

Apply (requires confirmation env):

```bash
export LIBRARY_MIGRATE_CONFIRM=yes
npx dotenv -e .env -e .env.local -- tsx scripts/library-migrate-local-to-prod/migrateLibraryData.ts --apply
```

Or use npm wrappers:

```bash
npm run library:migrate:dry
LIBRARY_MIGRATE_CONFIRM=yes npm run library:migrate:apply
```

### Optional flags

| Flag                    | Meaning                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `--apply`               | Perform writes inside a single transaction on `LIBRARY_DST_DATABASE_URL`.                    |
| `--allow-non-empty-dst` | Skip “destination must have zero active books” check (merge / expert use — not recommended). |

### After apply — verification (destination SQL)

```sql
SELECT COUNT(*) AS books FROM public.books WHERE deleted_at IS NULL;
SELECT COUNT(*) AS book_authors FROM public.book_authors;
SELECT COUNT(*) AS scripture_references FROM public.scripture_references WHERE deleted_at IS NULL;
SELECT id, email FROM public.profiles WHERE role = 'owner';
```

Then smoke the app `/library` and a representative `/library/books/[id]` (and scripture thumbnails if `source_image_url` pointed at migrated paths — bucket objects still need uploading if you relied on local Storage).

### Scripture Storage

This script only adjusts **path strings** when they use the `{profileId}/{bookId}/...` convention. **Binary objects** in `library-scripture-images` are not copied. Re-upload or use a dedicated object sync against the prod bucket if needed.
