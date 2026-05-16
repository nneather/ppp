# 022 — Library category removal + genre-only taxonomy

**Date:** 2026-05-16
**Module:** library
**Tracker session:** ad-hoc (taxonomy cleanup)

## Built

- **Audit (read-only):** Confirmed the duplication was structural, not just UI. Of 1,350 live books, 284 carry `primary_category_id`. Only 2 of the 7 seeded categories are actually used: Biblical Studies (257 books) and Languages & Reference (27). The other 5 (Theology, Church History, Pastoral & Practical, General / Trade, Personal) have zero books pointing at them. Crucially, **zero books have `genre IS NULL` while carrying a category** — every category-tagged book already has a more-specific genre. Snapshot: [docs/library_pre_category_drop_snapshot.md](../library_pre_category_drop_snapshot.md).
- **Backfill migration: skipped.** The plan called for a defensive Category → Genre UPDATE for `genre IS NULL` rows; the audit showed 0 matching rows. Shipping a no-op migration would have added noise to the migration history with zero data effect.
- **Code purge** (Phase 3a) — removed every reference to `categories`, `book_categories`, `primary_category_id`, `primary_category_name`, `category_ids`, `CategoryRow`, and `loadCategories` from `src/`. Files touched:
  - [src/lib/library/server/loaders.ts](../../src/lib/library/server/loaders.ts) — removed `loadCategories`, `RawCategory`, category JOINs in `loadBookList` / `loadBookListFiltered` / `loadReviewQueue` / `loadBookDetail`, `category_ids` + `primary_category_name` + `primary_category_id` from `BookDetail` return, `categories` dep from `loadBookFormPageData`.
  - [src/lib/library/server/book-actions.ts](../../src/lib/library/server/book-actions.ts) — removed `syncCategories`, dropped `primary_category_id` / `category_ids` from `BookFormPayload` + `parseBookForm` + `bookColumnsPayload` + insert/update flows.
  - [src/lib/types/library.ts](../../src/lib/types/library.ts) — removed `CategoryRow`, `primary_category_name` from `BookListRow`, `primary_category_id` / `primary_category_name` / `category_ids` from `BookDetail`; updated `BookListFilters` doc comment.
  - [src/lib/components/book-form.svelte](../../src/lib/components/book-form.svelte) — removed `categories` prop + `primary_category_id` / `extra_category_ids` state + Primary category Select + Additional categories chips + the `Biblical Studies` auto-default on Commentary; the form is also notably shorter on mobile now.
  - [src/routes/library/books/[id]/+page.svelte](../../src/routes/library/books/%5Bid%5D/+page.svelte) and [edit/+page.svelte](../../src/routes/library/books/%5Bid%5D/edit/+page.svelte) + [books/new/+page.svelte](../../src/routes/library/books/new/+page.svelte) — removed the Primary/Other category display rows and the `categories={data.categories}` prop passthroughs to `<BookForm>`.
  - [src/routes/library/+page.svelte](../../src/routes/library/+page.svelte) — removed the category chip on the list row.
  - [src/routes/library/books/[id]/+page.server.ts](../../src/routes/library/books/%5Bid%5D/+page.server.ts) and [edit/+page.server.ts](../../src/routes/library/books/%5Bid%5D/edit/+page.server.ts) — dropped `loadCategories` calls.
  - [src/lib/library/server/books-csv.ts](../../src/lib/library/server/books-csv.ts) — dropped `primary_category` from the import/export header set, removed `buildCategoryNameResolver` + `loadCategoryIdsByBookId` + `mergeCategoryIdsForUpdate`, simplified `csvRowToFormData` + `prepareLibraryBooksImport`. **Heads-up for anyone exporting/re-importing TSVs created pre-022:** the `primary_category` column is silently ignored on apply (PostgREST tolerates extra cells; the form parser doesn't look at it).
  - [src/routes/settings/audit-log/+page.server.ts](../../src/routes/settings/audit-log/+page.server.ts) — removed `book_categories` from `_LIBRARY_TABLES` whitelist + `entityLabelFor` switch.
  - **Deleted:** [src/routes/settings/library/categories/](../../src/routes/settings/library/categories/) (route + server file).
  - [src/routes/settings/library/+layout.svelte](../../src/routes/settings/library/+layout.svelte) + [+page.svelte](../../src/routes/settings/library/+page.svelte) — removed the Categories tab + section.
- **Schema migration** ([supabase/migrations/20260516160000_library_drop_categories.sql](../../supabase/migrations/20260516160000_library_drop_categories.sql)) — `ALTER TABLE books DROP COLUMN primary_category_id; DROP TABLE book_categories; DROP TABLE categories;`. Applied to prod via `npm run supabase:db:push` 2026-05-16. Verified via MCP query: 0 columns named `primary_category_id`, both tables gone, 1,350 live books intact.
- **Types regenerated** ([src/lib/types/database.ts](../../src/lib/types/database.ts)) — 61 lines removed; zero remaining mentions of the dropped artifacts.
- **PLAN.md + tracker** — Step A QA owner-phone-smoke acceptance rows ticked (Sessions 1, 3, 4 Pass 1, 5.5, 6). Pass 2 acceptance rows marked **N/A** per Q8 closure. Open Questions table closed Q4 (HTML+plain-text clipboard, no file export), Q6 (terminology unified), Q8 (DB is source of truth, importer retired); Q5 reframed as trip-period observational task; Q11 closed as superseded; Q12 added + resolved by this work. Pre-Session checklist items closed under shelf-now access.

## Decided (non-obvious)

- **Drop, don't refactor.** The user picked "structural — collapse to one taxonomy" out of four options including rename-only and consolidate-Language-Tools. The audit confirmed this was the right call: only 2 of 7 categories were used, and every used row already had a redundant genre.
- **No backfill UPDATE.** Wrote the plan as if rows might match (`genre IS NULL AND primary_category_id IS NOT NULL`) and turned out the audit said 0. Shipping a 0-row UPDATE migration adds nothing.
- **Skip TSV header back-compat.** Decided not to add a graceful "column ignored" warning on import when a `primary_category` cell shows up in a pre-022 TSV. PostgREST + `parseBookForm` already tolerate unknown FormData entries silently; users round-tripping their own export will just have one column dropped without explicit warning. If this becomes a friction point we'll add a parser-side hint.
- **`books.shelving_location` survives untouched.** Zero books currently use it (audit), but it's the right escape hatch if a "where on the physical shelf" need ever returns — and dropping unused free-text TEXT columns is cheap to defer.
- **`scripts/library-import/` not purged.** The Pass 1 importer + related CLIs (`patch-brockhaus-fixups`, `validate-pass1`, `spot-check`, `inspect-fk-orphans`, `migrationOverrides`, `buildImportRows`, `SPREADSHEET_OWNED_FIELDS`, the Path B migrate) all reference `primary_category_id` / `book_categories`. They're CLI artifacts (excluded from `npm run check`), retired per Q8 (DB is source of truth). Left in place as historical context; will not run cleanly against the post-022 schema if someone tries.
- **Live OL prefill genre rules unchanged.** Grep-verified zero category-drives-genre automations existed; the genre suggestion path (`suggestGenreFromSubjects`) reads OL `subjects` strings directly. "Commentaries get filled in as reference" continues to work via OL subject regex, not category mapping.

## Schema changes

- [20260516160000_library_drop_categories.sql](../../supabase/migrations/20260516160000_library_drop_categories.sql) — drops `books.primary_category_id`, `book_categories` table, `categories` table.

## New components / patterns added

- None. Pure removal.

## Open questions surfaced

- None. Q4, Q6, Q8 closed; Q5 reframed; Q11 superseded; Q12 added + resolved.

## Surprises (read before next session)

1. **Audit said 0.** The plan was written assuming Category → Genre backfill would touch a meaningful subset. It would have touched zero rows. Always run the cross-tab before sizing a data migration.
2. **Categories were a vestigial seed.** 5 of 7 categories had zero books. The audit doubled as a "what was actually being used" diagnostic; the answer was "barely anything."
3. **MCP `apply_migration` is read-only by policy.** The Supabase MCP in this workspace refuses DDL. `npm run supabase:db:push` is the only path. (Not a surprise per se — confirmed in [supabase/README.md](../../supabase/README.md) — but worth noting for future destructive ops.)
4. **41-value `GENRES` enum is bloating.** While auditing I noticed `Systematic Theology` / `Historical Theology` / `Biblical Theology` / `Applied Theology` alongside generic `Theology`, plus `Pastoral` next to `Pastoral Ministry`. Documented as a follow-up backlog item, not in scope here. The `/library/review` queue is the natural surface for tightening this incrementally.

## Carry-forward updates

- [x] components.mdc — no entries needed (pure removal; the Category-related Select wasn't a registered component).
- [x] AGENTS.md — no inventory entries needed (categories was never in the helper inventory).
- [x] db-changes.mdc — no new gotcha worth recording; code-first-then-schema rule already documented.
- [x] library-module.mdc — updated the "Patterns landed in Session 1" line referencing `syncCategories`.
- [x] tracker Open Questions updated (Q4, Q5, Q6, Q8, Q11, Q12).
- [x] PLAN.md "Recent decisions" rotated.
