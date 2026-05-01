# Library import — Session 4 (Pass 1 + Pass 2)

Reconcilable importer per [decision 007](../../docs/decisions/007-reconcilable-library-import.md). Same script handles Pass 1 (now, ~1,330 books from current spreadsheet) and Pass 2 (early August, with corrected v2 spreadsheet).

## Inputs (gitignored, in `data/`)

- `Library_1.xlsx` — source spreadsheet (1,330 rows, `Library` sheet)
- `enriched_library.csv` — Open Library enrichments (`row, title, author, match_type, isbn, publisher, year, pages, subtitle`)
- `Library_Migration_Notes.md` — local copy of the curated overrides (also committed at `docs/Library_Migration_Notes.md` for traceability)

## Outputs (gitignored, in `data/`)

- `rows.json` — fully-resolved import rows (1 per book, post-merge / overrides)
- `rows.report.txt` — counts, override audit, source-internal duplicates
- `library_import_diff.txt` — per-row INSERT/UPDATE/NO-OP/AMBIGUOUS/ORPHAN
- `library_import_orphans.csv` — books in DB but not in this CSV (Pass 2 manual review queue)

## Sequence

1. **Build rows**

   ```bash
   npx tsx scripts/library-import/buildImportRows.ts
   ```

   Writes `data/rows.json` + `data/rows.report.txt`. Read the report end-to-end. Look for: ORPHAN overrides (intentional or bug?), source-internal duplicate pairs, genre/subject distribution, override hit counts.

2. **Set required env in `.env.local`** (one-time)

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
   POS_OWNER_ID=<auth.users.id of your owner profile>
   ```

   Service-role key URL: `https://supabase.com/dashboard/project/<SUPABASE_REF>/settings/api-keys`
   Owner UUID: `SELECT id FROM auth.users WHERE email = '<your email>';`

3. **One-time pre-Pass-1 cleanup** — hard-DELETE the 15 Session 1 smoke books so they don't pollute the import diff or trip the title+author dedup:

   ```bash
   # Studio SQL editor:
   #   paste contents of supabase/seed/library_smoke_data_cleanup.sql
   ```

4. **Dry-run** (default — no writes)

   ```bash
   npx tsx scripts/library-import/importLibrary.ts
   ```

   Read `library_import_diff.txt`. Pass 1 expected shape:
   - INSERT: ~1,330 (everything is new)
   - UPDATE: 0
   - NO-OP: 0
   - AMBIGUOUS: 0
   - ORPHAN: 0

5. **One-row smoke** — verify audit attribution path

   ```bash
   npx tsx scripts/library-import/importLibrary.ts --apply --limit 1
   ```

   Then in Studio: `SELECT changed_by, table_name FROM audit_log ORDER BY changed_at DESC LIMIT 5;`. If `changed_by` is NULL on those rows, the post-apply patch (step 7) handles attribution; if it's the owner UUID, attribution worked end-to-end.

6. **Apply Pass 1**

   ```bash
   npx tsx scripts/library-import/importLibrary.ts --apply
   ```

   Watch batch progress (every 50 rows). Tail audit_log in Studio.

7. **(If audit attribution failed)** Patch audit_log post-apply:

   ```sql
   UPDATE public.audit_log
   SET changed_by = '<POS_OWNER_ID>'::uuid
   WHERE changed_by IS NULL
     AND changed_at >= '<pass1 start time>';
   ```

8. **Validation queries** (Studio):

   ```sql
   SELECT COUNT(*) FROM public.books WHERE deleted_at IS NULL;          -- ~1,330
   SELECT genre, COUNT(*) FROM public.books WHERE needs_review = false
     GROUP BY genre ORDER BY 2 DESC;                                     -- scholarly core
   SELECT COUNT(*) FROM public.book_authors;                             -- ~1,400+
   SELECT COUNT(*) FROM public.books WHERE language = 'german';          -- ~33 (Brockhaus + others)
   ```

## Pass 2 (early August)

Same script. Drop the new `Library_1.xlsx` + re-run `enrich_library.py` → `enriched_library.csv`. Re-run buildImportRows + dry-run + apply. The `SPREADSHEET_OWNED_FIELDS` constant ensures user-edited fields (`personal_notes`, `reading_status`, `rating`, `borrowed_to`, `shelving_location`, child rows) are byte-identical pre/post Pass 2.

## Files

| File | Purpose |
|---|---|
| `SPREADSHEET_OWNED_FIELDS.ts` | Single source of truth for what the importer can overwrite |
| `migrationOverrides.ts` | Hand-transcribed override map from `Library_Migration_Notes.md` |
| `buildImportRows.ts` | Pure XLSX + CSV + overrides → `rows.json` |
| `importLibrary.ts` | Service-role writes; `--dry-run` (default) or `--apply` |
