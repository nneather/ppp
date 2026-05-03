# Library migrate — Path B (source → destination Postgres)

Implements **Path B** when the **source** database has library rows that are **not** fully represented by the SQL under [`supabase/seed/`](/supabase/seed/) alone. **Source** and **destination** are **any two Postgres endpoints** the script can open — in practice, two [**Supabase Dashboard**](https://supabase.com/dashboard) **Connect → Direct** URIs (e.g. preview branch → prod, or staging project → prod) are enough. **No Docker Desktop or local Supabase is required** unless you choose `127.0.0.1:54322` as the source. Paths **A** and **C** do not need this tooling (see below).

## Path A — Data matches git seeds only

Run these **in order** against the live project (SQL editor or `psql`), after migrations:

1. [`supabase/seed/library_seed.sql`](/supabase/seed/library_seed.sql)
2. [`supabase/seed/library_smoke_data.sql`](/supabase/seed/library_smoke_data.sql)
3. Optionally [`supabase/seed/library_scripture_fixture.sql`](/supabase/seed/library_scripture_fixture.sql)

## Path C — Canonical source is the spreadsheet importer

Follow [`scripts/library-import/README.md`](../library-import/README.md) (`POS_OWNER_ID`, `importLibrary.ts --apply`).

## Path B — Programmatic row copy (`migrateLibraryData.ts`)

Copies core **user library** tables from **source** Postgres to **destination** Postgres, preserving primary keys while remapping FKs that differ between databases. The script does **not** care whether either host is “local” or “cloud” — only that both URIs are valid and reachable.

| Remap                              | How                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `created_by` → owner on dst        | All non-null `created_by` are set to the destination **owner** `profiles.id` (from `profiles.role = 'owner'`). Nulls stay null.                                                                                                                        |
| `categories`                       | Every `books.primary_category_id` and `book_categories.category_id` mapped by **`slug`** (seeded reference data).                                                                                                                                      |
| `ancient_texts`                    | Every `book_ancient_coverage.ancient_text_id` mapped by **`canonical_name`**.                                                                                                                                                                          |
| `series`                           | Rows referenced by `books.series_id` are matched on destination by `name` + `abbreviation` when possible, else **`name`** only; if still missing on dst, the series row is inserted.                                                                          |
| Storage paths (`source_image_url`) | Paths that start with a **source profile id** (first path segment before `/`) get that segment rewritten to the **destination owner** id — same assumption as migrating scans under the destination owner prefix. External `http(s)://` URLs are left unchanged. |

**Does not**: copy auth, `profiles`, reference rows (`categories`, `bible_books`, …), Storage objects, or `audit_log`.

### Preconditions

1. **Migrations**: destination schema matches the repo (`npm run supabase:db:push` on the destination project).
2. **Reference seeds** on destination: run Path A step 1 at minimum so `categories` / `bible_books` / `ancient_texts` exist (`library_seed.sql`).
3. **Empty corpus** on destination by default — no non–soft-deleted `books` (`COUNT(*) WHERE deleted_at IS NULL` must be **0**) unless you pass `--allow-non-empty-dst`.

### Env

Put these in **`.env.local`** at the repo root (gitignored). `npm run library:migrate:*` loads `.env` then `.env.local` via `dotenv-cli` — same pattern as other scripts.

| Variable | Purpose |
| -------- | ------- |
| `LIBRARY_SRC_DATABASE_URL` | **Source** Postgres URI — usually from Supabase Dashboard → **Connect → Direct** for the project or **branch** that holds the corpus to copy from. **Required.** |
| `LIBRARY_DST_DATABASE_URL` | **Destination** Postgres URI — same Dashboard path on the target (often primary prod). **Connect → Direct** (or pooler if Supabase recommends). **Required.** |
| `LIBRARY_MIGRATE_CONFIRM` | Set to `yes` only for `--apply`; refuses writes without it. |

Two connection strings (**never commit** secrets). Typical **Supabase-project-only** setup — both from the Dashboard:

```bash
# Source: project or branch where the library data already lives
LIBRARY_SRC_DATABASE_URL='postgresql://postgres:[SRC_PASSWORD]@db.<source-ref>.supabase.co:5432/postgres'

# Destination: target project (e.g. prod) — empty active books unless you use --allow-non-empty-dst
LIBRARY_DST_DATABASE_URL='postgresql://postgres:[DST_PASSWORD]@db.<dest-ref>.supabase.co:5432/postgres'
```

**Optional — local Supabase Postgres as source**

If you run **local** Supabase (CLI `supabase start`), the DB URL is often `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Local Supabase still needs **a container runtime** on the machine; it is **not** the default path for Path B when you work entirely from hosted projects.

**URI hygiene**

- Remove any stray character after the database name (e.g. a mistaken `>` at the end of the line).
- If the database password contains `@`, `:`, `/`, `?`, `#`, `[`, `]`, or `%`, **percent-encode** those characters in the password segment of the URI (e.g. `]` → `%5D`).

**Source connectivity**

- If **`LIBRARY_SRC_DATABASE_URL`** points at **`127.0.0.1:54322`** and dry-run fails with **`ECONNREFUSED`**, local Postgres is not running — start your local Supabase stack or **switch SRC to a hosted Supabase URI** instead.
- If **both** URLs are **hosted** Supabase and you see auth errors (`password authentication failed`), fix the URI or percent-encode special characters in the password — do not assume Docker.

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

`npm run library:migrate:apply` only passes `--apply`. For **`--allow-non-empty-dst`**, use the full `npx dotenv … tsx … --apply --allow-non-empty-dst` command above.

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

Then smoke the app `/library` and a representative `/library/books/[id]` against the **destination** project (and scripture thumbnails if `source_image_url` pointed at migrated paths — bucket objects still need uploading if you relied on Storage on the source).

### Scripture Storage

This script only adjusts **path strings** when they use the `{profileId}/{bookId}/...` convention. **Binary objects** in `library-scripture-images` are not copied. Re-upload or use a dedicated object sync against the prod bucket if needed.
