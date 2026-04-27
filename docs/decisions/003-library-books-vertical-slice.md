# 003 — Library books vertical slice (Session 1)

**Date:** 2026-04-25
**Module:** library
**Tracker session:** Session 1 (+ Session 1.5 follow-ups: Track 0 compatibility, Track D B1/B2, Track E Session 2 jump-start)

## Built

- **List page** at [`src/routes/library/+page.svelte`](../../src/routes/library/+page.svelte) and [`+page.server.ts`](../../src/routes/library/+page.server.ts) — mobile cards, desktop table, genre / category / series chips, reading_status + needs_review badges, "Add book" entry into `<BookFormSheet>`. Handles `?deleted=<id>` query param after a soft-delete redirect.
- **Detail page** at [`src/routes/library/books/[id]/+page.svelte`](../../src/routes/library/books/[id]/+page.svelte) and [`+page.server.ts`](../../src/routes/library/books/[id]/+page.server.ts) — full hydrated detail (authors with roles, primary + extra categories, series + volume), Edit opens sheet, Delete fires soft-delete → 10s undo toast → redirect after timeout.
- **`<BookFormSheet>`** at [`src/lib/components/book-form-sheet.svelte`](../../src/lib/components/book-form-sheet.svelte) — single sheet for create + edit (mode prop). Sections: Identity, Authors, Classification, Publication, Reprint, Identifiers & shelf, State. Authors junction has up/down arrow reorder, role select per row, B14 dedup hint inline, and an inline "New person" dialog that POSTs `?/createPerson` via `fetch + deserialize` and immediately adds the new person to the picker without a page reload.
- **Server helpers** at [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts) (`loadBookList`, `loadBookDetail`, `loadCategories`, `loadSeries`, `loadPeople`, `loadPersonBookCounts`, `personDisplayShort/Long`) and [`book-actions.ts`](../../src/lib/library/server/book-actions.ts) (`createBookAction`, `updateBookAction`, `softDeleteBookAction`, `undoSoftDeleteBookAction`, `createPersonAction`, `parseBookForm`). Both list and detail page-server files thinly wrap the helpers so the action surface is shared.
- **Closed enums + view-models** at [`src/lib/types/library.ts`](../../src/lib/types/library.ts): `GENRES` (12 tracker-aligned), `LANGUAGES`, `READING_STATUSES`, `AUTHOR_ROLES` + label maps + `BookListRow` / `BookDetail` / `PersonRow` / `CategoryRow` / `SeriesRow` shapes.
- **Schema delta** at [`supabase/migrations/20260425160000_library_delta_v1.sql`](../../supabase/migrations/20260425160000_library_delta_v1.sql): `books.needs_review_note`, `books.page_count`, `books.language` add `'french'`, `people.aliases TEXT[]`, `people.middle_name`, `people.suffix`, `people.deleted_at`, `series.deleted_at`. Staged, not pushed.
- **Seed** at [`supabase/seed/library_seed.sql`](../../supabase/seed/library_seed.sql): 66 bible_books, ~70 ancient_texts (Josephus / Philo / Apostolic Fathers / Apocrypha), 8 series (ICC / NTC / OTL / EKK / TWOT / AB / MH / COT), 7 categories (Theology / Biblical Studies / Church History / Pastoral & Practical / Languages & Reference / General-Trade / Personal). Viewer permissions block commented out pending UUID.
- **Smoke-test data** at [`supabase/seed/library_smoke_data.sql`](../../supabase/seed/library_smoke_data.sql) (Track C): five realistic books with people + book_authors + book_categories + series. Idempotent. Run after delta + base seed.
- **B1/B2 enforcement** at [`supabase/migrations/20260425170000_books_viewer_column_protection.sql`](../../supabase/migrations/20260425170000_books_viewer_column_protection.sql) + viewer-aware app-layer strip in `updateBookAction` (Track D).
- **Session 2 prep** (Track E): `src/lib/library/polymorphic.ts`, `<SourcePicker>`, `<ScriptureReferenceForm>`, `scripture-actions.ts`, `search_scripture_refs(...)` SQL function, 20-row scripture fixture. Components compile but are not yet wired into book detail page; Session 2 builds the integration.

## Decided (non-obvious)

- **Junction sync is diff-based, not delete-all-then-reinsert.** `syncAuthors` and `syncCategories` in [`book-actions.ts`](../../src/lib/library/server/book-actions.ts) compute insert / update / delete sets relative to current rows. Audit log shows minimal diffs — change only one author's role, only that role's row gets logged. Tradeoff: more code, but the audit trail is honest.
- **Inline person create uses `fetch + deserialize`, not nested form actions.** Mid-form-fill the user clicks "New person" → opens dialog → POSTs to `?/createPerson` via `fetch` → parses the action result with `deserialize` from `$app/forms` → mutates the local `people` array and selects the new id in the author row. No page reload, no `invalidate()` race. Pattern to reuse for any inline create from inside another sheet.
- **Person dedup hint is inline, not a separate combobox.** B14 surfaces "N other person(s) share Smith, J." as a yellow caption below the picker once a person is selected. The full `<CanonicalizingCombobox>` lands in Session 5; the hint is the Session 1 stand-in.
- **Up/down arrow reorder for authors instead of HTML5 drag.** Drag-on-mobile is fragile; arrow buttons work everywhere. Tracker spec said "drag-reorder" but the spirit is "user can change sort_order"; arrows satisfy that. If desktop drag is wanted later, it's purely additive.
- **Action duplication across list + detail page-servers.** Both `/library/+page.server.ts` and `/library/books/[id]/+page.server.ts` host `updateBook` / `softDeleteBook` / `undoSoftDeleteBook` / `createPerson`. Implementation is shared via the `book-actions.ts` helpers; the per-route handlers are 4-line wrappers. Cleaner than posting cross-route from `<BookFormSheet>`, which would have lost form-state on the host page.
- **Single `<BookFormSheet>` for create + edit** mirroring the `<TimeEntrySheet>` pattern (`book == null` ⇒ create). Mode prop drives the action URL (`?/createBook` vs `?/updateBook`).
- **Categories: 7 names confirmed Round 2.** Theology, Biblical Studies, Church History, Pastoral & Practical, Languages & Reference, General / Trade, Personal. Slugs match (kebab-case). The `library_seed.sql` originally shipped with these commented; uncommented after Round 2.
- **Genres: 12 tracker-aligned.** Commentary, Bibles, Biblical Reference, Greek/Hebrew/Latin/German/Chinese Language Tools, Theology, Church History, Pastoral, General. Closed at the UI layer (constant in `src/lib/types/library.ts`) — schema CHECK is open TEXT, so the form is the only enforcement layer until/unless we add a CHECK in a future migration.
- **Soft-delete UX: 10s undo toast.** Click Delete → immediate soft-delete → toast appears with Undo button → 10s timer → if untouched, redirect to `/library?deleted=<id>` so the list page can surface a banner. Undo posts to `?/undoSoftDeleteBook` and invalidates the page data.
- **`as never` casts at the supabase boundary** for SELECTs/inserts that reference columns added by `library_delta_v1.sql`. Existing pattern from [`src/routes/settings/audit-log/+page.server.ts`](../../src/routes/settings/audit-log/+page.server.ts) (revert path). Removable in a follow-up after `npm run supabase:gen-types` runs post-apply.

## Schema changes

- [`20260425160000_library_delta_v1.sql`](../../supabase/migrations/20260425160000_library_delta_v1.sql) — books × 3 (`needs_review_note`, `page_count`, `'french'` in language CHECK) + people × 4 (`aliases TEXT[]`, `middle_name`, `suffix`, `deleted_at`) + series × 1 (`deleted_at`). All `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` guarded.
- [`20260425170000_books_viewer_column_protection.sql`](../../supabase/migrations/20260425170000_books_viewer_column_protection.sql) (Track D) — `enforce_books_viewer_columns()` BEFORE UPDATE trigger raising `EXCEPTION` if a non-owner attempts to change `personal_notes` or `rating`.
- [`20260425180000_search_scripture_refs.sql`](../../supabase/migrations/20260425180000_search_scripture_refs.sql) (Track E) — `search_scripture_refs(p_bible_book TEXT, p_chapter INT, p_verse INT)` SQL function with overlap-index lookup; `SECURITY INVOKER`; `GRANT EXECUTE` to authenticated.

## New components / patterns added

- [`src/lib/components/book-form-sheet.svelte`](../../src/lib/components/book-form-sheet.svelte) — entity form sheet with junction UI. Update [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc).
- [`src/lib/components/source-picker.svelte`](../../src/lib/components/source-picker.svelte) (Track E) — polymorphic `(book_id OR essay_id)` picker, essay branch stubbed disabled. Reuse target for `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage` per [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc).
- [`src/lib/components/scripture-reference-form.svelte`](../../src/lib/components/scripture-reference-form.svelte) (Track E) — embedded sub-form for adding refs to a book or essay. Wraps `<SourcePicker>`. Validates page_start/page_end as TEXT (no coercion of `IV.317` / `xiv`).
- [`src/lib/library/polymorphic.ts`](../../src/lib/library/polymorphic.ts) (Track E) — `PolymorphicParent` discriminated union, `validateXor`, `insertPolymorphicRow<T>`. Documents the four reuse-target tables and the `FEATURE_ESSAYS_UI` gate.
- [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts) — load helpers shared between list + detail.
- [`src/lib/library/server/book-actions.ts`](../../src/lib/library/server/book-actions.ts) — form action implementations. Pattern: server actions are thin wrappers around helpers in `src/lib/<module>/server/`.
- [`src/lib/library/server/scripture-actions.ts`](../../src/lib/library/server/scripture-actions.ts) (Track E) — same shape, scripture_references domain.
- **Pattern: diff-based junction sync.** See `syncAuthors` / `syncCategories` in `book-actions.ts`. The right call when junction rows have meaningful sort_order or extra columns (role, weight, etc.).
- **Pattern: inline create-via-fetch.** See `submitPersonDialog` in `book-form-sheet.svelte`. The right call when a sub-entity has to be created without losing the parent form's local state.
- **Pattern: pre-regen migration columns.** See `bookColumnsPayload` and `loadPeople`. When a delta migration is staged but unapplied, never name the new columns in SELECT lists, and conditionally include them in INSERT/UPDATE payloads when populated. Add back to SELECTs after `gen-types` runs.

## Open questions surfaced

- **Storage bucket name + RLS for `source_image_url`** — Tracker_1 Open Question 3, owner = pre-Session 2. `<ScriptureReferenceForm>` ships in this round with manual URL entry only; no upload yet.
- **Viewer UUID still pending** — Round 1 placeholder in seed. Required for the "viewer can / cannot do X" acceptance lines on Sessions 1 + 2.
- **B6 merge cascade for books** — post-fall (only matters when book-merge tooling ships).
- **E4 / E5 / E10** — essays UI scope, deferred until Session N when essays UI is decided.
- **Subject vs genre terminology** — Tracker_1 Open Question 6, owner = pre-Session 4. `Library_Migration_Notes.md` (external) needs the doc-side rewrite before Session 4 imports anything.

## Surprises (read these before Session 2)

1. **`series` and `people` did NOT have `deleted_at` in the baseline.** The schema doc convention says every user-data table has the column; the baseline didn't include it on these two. My Session 1 loaders filtered by it and crashed (`column ... does not exist`) when the dev server was first hit. Track 0 added the columns to `library_delta_v1.sql` and dropped the filters from the loaders with TODO markers to re-add post-migration. Lesson: when writing loaders, *cross-check* the SELECT against `00000000000000_baseline.sql`, not against the schema doc.
2. **PostgREST rejects SELECTs that name absent columns.** The `as never` cast at the supabase-js boundary protects TypeScript, not runtime — the SQL still goes out with the column name, and PostgREST 42703s. The pattern is: omit the column from the SELECT entirely until the migration applies; map a default in the view-model. Same applies to INSERT/UPDATE payloads — omit the key when the value is null so the payload doesn't reference the column.
3. **`compute_verse_abs` whole-book / chapter-level semantics.** The trigger encodes "no chapter" as `verse_start_abs = 0` and `verse_end_abs = 999999`; "chapter only, no verse" as `verse_start_abs = chapter*1000`, `verse_end_abs = chapter*1000 + 999`. The `search_scripture_refs(...)` SQL function in Track E was written against this; if the trigger ever changes, the function must change with it.
4. **Dev server hot-reload eats stale errors.** The terminal log showed an "Invalid export 'PAGE_SIZE'" trace from before the `_PAGE_SIZE` rename. False alarm — rebuild clears it.
5. **`<Sheet>` body becomes scroll-bound on mobile when content overflows.** The form sheet uses `max-h-[94dvh]` on bottom side specifically so the sticky footer stays accessible. Don't bump heights without re-testing mobile.
6. **`write_audit_log()` assumed every audited table has an `id` column** — surfaced when the smoke seed tried to INSERT into `book_authors` (composite PK on `book_id, person_id, role`) and the trigger 42703'd on `NEW.id`. Same latent bug affects `book_categories` and `essay_authors`. Fixed by [`20260425190000_audit_log_composite_pk_fix.sql`](../../supabase/migrations/20260425190000_audit_log_composite_pk_fix.sql) which resolves `record_id` via `to_jsonb(NEW)->>'id'` with a COALESCE fallback to `book_id` / `essay_id`. Side-benefit: filtering `/settings/audit-log` by a book's UUID now surfaces every junction change attached to that book, not just edits to the books row itself. Lesson for the rules: when adopting `write_audit_log()` for a new module, audit-walk every new table for the assumption "all PKs are `id`."

## Carry-forward updates

- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) ticked for what's actually shipped.
- [x] [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc) — `<BookFormSheet>`, `<SourcePicker>`, `<ScriptureReferenceForm>` rows added.
- [x] [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc) — Session 1 patterns subsection appended.
- [x] [`AGENTS.md`](../../AGENTS.md) — library helpers added to inventory.
- [ ] **Manual: apply `library_delta_v1.sql` + `books_viewer_column_protection.sql` + `search_scripture_refs.sql`** then `npm run supabase:gen-types` and commit `src/lib/types/database.ts`.
- [ ] **Manual: run `library_seed.sql` + `library_smoke_data.sql`** in Studio SQL editor.
- [ ] **Manual: paste viewer UUID** into `library_seed.sql` user_permissions block and rerun.
- [ ] **Manual: post-apply, re-add `deleted_at` filters** to `loadPeople` / `loadSeries` and the new-column SELECTs to `loadPeople` / `loadBookDetail` in [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts) — search for `TODO post-delta-v1`.
- [x] No new env vars introduced.

## Session 2 jump-start (Track E details)

The components and SQL function below compile against the current types but are NOT yet wired into `/library/books/[id]`. Session 2 builds the integration. The work below removes ~3h of mechanical scaffolding from Session 2.

### Built ahead

- **[`src/lib/library/polymorphic.ts`](../../src/lib/library/polymorphic.ts)** — `PolymorphicParent` discriminated union (`{ kind: 'book'; book_id } | { kind: 'essay'; essay_id }`), `validateXor` validator, `polymorphicToColumns` mapper, `insertPolymorphicRow<T>` helper that takes a parent + table-specific extras and writes the right shape. `FEATURE_ESSAYS_UI = false` constant gates the essay branch globally. The four reuse-target tables are listed in the file header.
- **[`<SourcePicker>`](../../src/lib/components/source-picker.svelte)** — book / essay toggle, book autocomplete via existing `BookListRow` data, essay branch rendered disabled with the "ships post-fall" message. Supports `lockedBookId` for the common case (form on `/library/books/[id]` always picks the host book; user can't re-select).
- **[`src/lib/library/server/scripture-actions.ts`](../../src/lib/library/server/scripture-actions.ts)** — `createScriptureRefAction`, `updateScriptureRefAction`, `softDeleteScriptureRefAction`. Same `{ kind, success?, message?, refId? }` discriminator as `book-actions.ts`. Page numbers validated as TEXT (no INT coercion). `updateScriptureRefAction` enforces S12 (cannot move a ref to a different parent — must delete-and-recreate).
- **[`<ScriptureReferenceForm>`](../../src/lib/components/scripture-reference-form.svelte)** — embedded sub-form (not a sheet). Wraps `<SourcePicker>`. Fields: bible_book Select against the 66 bible_books, chapter/verse inputs, page_start/page_end TEXT, needs_review checkbox + note, source_image_url TEXT placeholder. Manual upload UI deferred until Storage bucket name is decided (Tracker_1 Open Question 3).
- **[`20260425180000_search_scripture_refs.sql`](../../supabase/migrations/20260425180000_search_scripture_refs.sql)** — `search_scripture_refs(p_bible_book TEXT, p_chapter INT DEFAULT NULL, p_verse INT DEFAULT NULL)`. Overlap predicate inclusive on both ends per S4/S5/S6. Manual entries (NULL `confidence_score`) sort first per S7. JOIN to `books` so the result includes title + subtitle; `WHERE b.deleted_at IS NULL` matches the app-layer JOIN-filter (S11). `SECURITY INVOKER`, `GRANT EXECUTE` to authenticated.
- **[`supabase/seed/library_scripture_fixture.sql`](../../supabase/seed/library_scripture_fixture.sql)** — 20 references across the 5 smoke-data books exercising verse-level / verse-range / chapter-only / whole-book patterns. Idempotent. Includes the verification queries to paste into Studio after the seed runs.

### Session 2 integration (NOT yet done — these are the remaining tasks)

1. Add load helpers `loadBibleBooks(supabase): string[]` and `loadScriptureRefsForBook(supabase, bookId)` to [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts).
2. In [`/library/books/[id]/+page.server.ts`](../../src/routes/library/books/%5Bid%5D/+page.server.ts):
   - Add the new loaders to the `Promise.all`.
   - Add `createScriptureRef`, `updateScriptureRef`, `softDeleteScriptureRef` action handlers (4-line wrappers calling the helpers in `scripture-actions.ts`).
3. In [`/library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte):
   - Render the existing scripture references in a list (page_start, chapter/verse, edit/delete affordances).
   - Embed `<ScriptureReferenceForm>` with `lockedBookId={data.book.id}` and `bibleBookNames={data.bibleBookNames}`.
4. Verify the trigger via SQL: `INSERT ... ('Philippians', 2, 1, 2, 11)` then assert `verse_start_abs = 2001`, `verse_end_abs = 2011`.
5. Build `/library/search-passage/+page.{server.ts,svelte}` calling `search_scripture_refs(...)` per Tracker_1 Session 3, with a deep-link back to `/library/books/[id]#ref-<uuid>`.

### Acceptance gates that still need the user

- After applying `library_delta_v1.sql` + `library_seed.sql` + `library_smoke_data.sql` + `library_scripture_fixture.sql`, run the verification queries in the fixture file and confirm `search_scripture_refs('Philippians', 2, 5)` returns the expected 4 rows.
- Viewer write/non-write parity tests for `scripture_references` (S1 — viewer can update *own* rows only) — needs viewer UUID in `library_seed.sql`.
- B1/B2 viewer trigger smoke: viewer attempts to PATCH `personal_notes` via curl, expects `42501` from the trigger.
