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

## Session 1.5 polish sweep (2026-04-28)

User smoke test surfaced four bugs and a list of polish requests; full sweep landed in one chat.

### Built

- **`<PersonAutocomplete>`** at [`src/lib/components/person-autocomplete.svelte`](../../src/lib/components/person-autocomplete.svelte) — typeahead replacement for the per-author Person `<Select>`. Live filter on `last_name + first_name + aliases[]`, top 8 matches, B14 dedup warning inline on each result row, "+ Create '<typed>'" affordance when no exact match. Keyboard nav (Arrow up/down, Enter, Escape). Prototype for the `<CanonicalizingCombobox>` shipping in Session 5.
- **`<BookFormSheet>` rework**: hand-rolled fixed-position person modal replaced with shadcn `<Dialog>` primitive (fixes outside-click dismissing the parent Sheet); two header buttons collapsed into one `+ Add author` (autocomplete handles create-flow); `+ Create '<typed>'` from the autocomplete pre-fills the Dialog with parsed first/last name; primary category default flipped from "first category" to blank.
- **B14 collision warning before person create**: pre-flight check in `submitPersonDialog` against existing `last_name + first_initial` matches; surfaces a yellow warning + "Continue anyway" / "Cancel" pattern. Re-arms when the user edits the name fields.
- **Detail-page delete** now `redirect(303, '/library?deleted=<id>')` instead of returning a success object — fixes the post-delete 404 from `loadBookDetail` returning null. The 10s undo toast lives on the list page where it can survive the redirect; existing `?deleted=` banner upgraded with auto-dismiss timer + Undo + Dismiss controls.
- **Inline reading_status edit** on list view (mobile cards + desktop table) and detail page header. `updateReadingStatusAction` lives in `src/lib/library/server/book-actions.ts`; both `/library` and `/library/books/[id]` host the action. Optimistic UI patches the badge tone instantly.
- **Article-stripped sort** in `loadBookList` — "The Book of Exodus" sorts under B not T. Client-side after the SELECT, since the dataset is small (1,288-book ceiling) and Session 3 will introduce real sort/filter UI anyway.
- **Author display** changes: `personDisplayShort` returns `"First Last"` (with middle initial when present) instead of `"Last, F."`.
- **Series hover tooltip**: native `title=` attr on the abbreviation chip (zero-dep). New `series_name` field on `BookListRow`.
- **Audit log soft-delete display**: `deriveDisplayOperation` synthesizes `'SOFT_DELETE' | 'SOFT_RESTORE'` when an UPDATE diff is exclusively a `deleted_at` flip. `<AuditRow>` renders `DELETE` / `RESTORE` badge labels and friendly summary text. The Revert button label flips to "Restore" / "Re-delete" accordingly.
- **Audit log soft-delete revert**: new `_SOFT_DELETE_REVERTIBLE_TABLES` whitelist (covers all soft-deletable tables in invoicing + library); revert action short-circuits to a single-key `{ deleted_at: null|now() }` patch instead of whole-row replacement, sidestepping the polymorphic-CHECK / computed-column risks that excluded library from full revert.
- **Audit log entity name**: `entityLabelFor(table_name, ...)` extracts a friendly label per table (book title, person full name, series abbrev — name, scripture-ref formatted as `Bible Book ch:vs`, etc.). Junction tables intentionally return null because `record_id` is already the parent UUID after the composite-PK fix.
- **Phase 0 cleanup**: dropped the `// TODO post-delta-v1` compat shims from `loaders.ts` (re-added the dropped column SELECTs and `deleted_at` filters) and `book-actions.ts` (un-conditionalized `needs_review_note` / `page_count` / `middle_name` / `suffix` keys). `npm run supabase:gen-types` ran post-apply; `database.ts` shows the new columns.
- **Bug-fix to `package.json`**: added the missing `supabase:gen-types` script that was referenced in docs but never defined.

### Decided (non-obvious)

- **`<PersonAutocomplete>` is intentionally pre-`<CanonicalizingCombobox>`-shaped** so when Session 5 ships the canonicalization combobox for `ancient_texts.canonical_name + abbreviations[]`, this component can converge with it (or get replaced cleanly). The shape — bind:value, items, onCreate(rawText), keyboard nav, "Create new" affordance — is the same.
- **Optimistic UI for inline reading_status** patches the badge tone instantly without waiting for revalidate. If the server rejects, `update({ reset: false })` re-loads `data.book.reading_status` and the optimistic patch is overridden. Trade: a brief flicker if the server fails; UX win the 99% of the time it succeeds.
- **Soft-delete revert sidesteps the strip-list** because the patch is single-key. No need to run the `id` / `created_at` / `updated_at` / `verse_*_abs` strip dance — the only mutation is `deleted_at`. Library tables that were excluded from full revert now support this narrower revert cleanly.
- **Display-layer soft-delete detection** (not a `write_audit_log()` change) keeps the trigger semantics intact for invoicing's existing audit trail, which already shows soft-deletes as UPDATEs and would visually shift if we changed the operation enum.
- **Native `title=` tooltips** instead of a UI-lib Tooltip primitive — zero-dep and good enough for the single hover surface. Promote to a real Tooltip when more hover affordances accumulate.
- **Author parser** for `+ Create "<typed>"` is naive: `"Robert Bauckham"` → `{ first: 'Robert', last: 'Bauckham' }`; single token = last name; multi-word first names ("R. Laird Harris") parse as `first: 'R. Laird'`, `last: 'Harris'`. The user can correct in the Dialog before saving.

### New components / patterns added

- [`src/lib/components/person-autocomplete.svelte`](../../src/lib/components/person-autocomplete.svelte) — typeahead with debounced filter, B14 inline warnings, +Create affordance. Register in `.cursor/rules/components.mdc`.
- **Pattern: optimistic-UI inline edit via use:enhance** — see `statusSubmit` in [`src/routes/library/+page.svelte`](../../src/routes/library/+page.svelte). The submit factory captures the user's intent into a local optimistic map, then the post-update phase clears the optimistic patch (the canonical state from the load function takes over).
- **Pattern: soft-delete revert at the audit-log layer** — single-key patch, no whole-row replace. Add a table to `_SOFT_DELETE_REVERTIBLE_TABLES` to enable; no other glue required.
- **Pattern: nested modals on top of `<Sheet>`** — must use shadcn `<Dialog>` (or another portal-based primitive that stops event propagation), never a hand-rolled `<div class="fixed">`. Outside-click handlers on the `<Sheet>` will eat parent state otherwise.

### Schema changes

None. Phase 0 was code-side cleanup only; all new behaviors are in app code.

### Open questions surfaced

- **Sort + filter UI** is a Session 3 deliverable per Tracker_1; the Session 1.5 sort fix is server-side only and doesn't expose chips/Sort dropdown.
- **Review queue page** still doesn't exist; the `Review` badge on the list view is a static `<span>` with `title=` placeholder. Adding the route + filter behavior is its own session.
- **Barcode integration** for the create flow — Session 6 per Tracker_1.

### Surprises (read these before the next session)

7. **`bind:ref` on `<Input>` requires `$state` in Svelte 5 runes mode** — I initially declared `let inputEl: HTMLInputElement | null = null;` and `svelte-check` warned `non_reactive_update`. Wrapping in `$state(...)` fixes it. Pattern to remember for any DOM-ref pattern that needs reactivity.
8. **The `package.json` `supabase:gen-types` script was missing** — referenced in `AGENTS.md`, the `db-changes.mdc` rule, and the audit doc, but never actually defined as a script. Added it. If you hit "Missing script" anywhere else, the doc-vs-script gap might be elsewhere too.

### Carry-forward updates

- [x] [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc) — `<PersonAutocomplete>` row added.
- [x] [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc) — soft-delete-revert pattern + typeahead pattern + nested-modal-via-Dialog pattern appended.
- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 1 acceptance lines updated for post-polish state.
- [x] `package.json` `supabase:gen-types` script added.
- [x] No new env vars introduced.

### Test plan to walk after Session 1.5

The same five smoke items from before, plus:

- Click Delete on a book detail page → land on `/library` with the 10s undo toast; click Undo → book restored, navigate to detail page.
- Type "Bauckham" in an author row's autocomplete → existing "Richard Bauckham" appears with book count; click `+ Create "Robert Bauckham"` → Dialog opens with first=Robert, last=Bauckham pre-filled; submit → see B14 warning ("Already in your library: Richard Bauckham. Continue?"); click Continue anyway → row populated with Robert Bauckham; B14 inline hint shows under the row.
- Open a fresh "Add book" sheet → Primary Category reads `— Pick a category —`; Save button disabled until a category is picked.
- Click outside the Add-person Dialog while form fields are filled → Dialog dismisses but BookFormSheet stays open with all fields preserved.
- Change reading_status from list view → badge tone updates instantly; check `/settings/audit-log` filtered to library → see the UPDATE attributed correctly with entity name (book title) prominent.
- Soft-delete a book → audit log shows red `DELETE` badge with book title; click Restore → book reappears in list, new audit row appended showing `RESTORE`.
- Open `/library` with `?deleted=<id>` after a delete → 10s toast appears with Undo button; click Undo → book restored, navigate to detail.

## Session 1.5b follow-ups (2026-04-28)

User testing surfaced three issues: smoke data lost author junctions on re-run, the new-book sheet still loses fields on outside-click, and primary category is too prescriptive at entry time.

### Built

- **Smoke seed re-runnable** at [`supabase/seed/library_smoke_data.sql`](../../supabase/seed/library_smoke_data.sql). Author and category junction inserts now look the book up by title each run (rather than depending on the same-statement RETURNING from the books INSERT). Re-running the file silently re-attaches any missing junctions on existing books. Diagnosis: the original CTE pattern `WITH ins AS (INSERT … WHERE NOT EXISTS … RETURNING id) INSERT INTO book_authors SELECT FROM ins, …` produced zero junction rows when the books INSERT was deduped by an existing row, leaving books authorless until re-edit.
- **10 more books** in the smoke seed (15 total): Carson on John, Schreiner Romans (2nd ed), Bock Luke vols I+II, Carson + Moo NT Intro (multi-author), Childs Biblical Theology of OT/NT, Hurtado Lord Jesus Christ, Wright COQG vols I + II (now alongside the existing vol III), Beale NT Biblical Theology. Six new people added (D. A. Carson, T. R. Schreiner, D. L. Bock, D. J. Moo, L. W. Hurtado, G. K. Beale). Variety exercises the typeahead's dedup hint (three Wrights, two Bock vols), multi-author pattern, multi-edition pattern.
- **`books.primary_category_id` nullable** via [`supabase/migrations/20260428160000_books_primary_category_nullable.sql`](../../supabase/migrations/20260428160000_books_primary_category_nullable.sql) (`ALTER COLUMN … DROP NOT NULL`). Applied + types regenerated.
- **Form changes**: `parseBookForm` coerces empty primary_category_id to `null` instead of erroring; `BookFormPayload.primary_category_id` becomes `string | null`; primary-category Select gets a `— None —` top option and the Label drops the required asterisk + adds an "Optional — leave as 'None' if unsure" hint; Save button now disabled only when title is blank (was: title OR primary_category_id).
- **UI rendering for null primary**: list-view chip already conditional on `primary_category_name`; detail-view `Primary category` row now renders `(uncategorized)` italic when null instead of the existing `'—'` fallback (more obvious as actionable than ambiguous). Loader maps `cat?.name ?? null` (was `?? '—'`).
- **Dirty-form confirm dialog on `<BookFormSheet>` dismissal**. Snapshot of all 27 form fields + author rows is captured in the open-effect. `dirty = $derived(open && currentFormSnapshot() !== initialSnapshot)`. The Sheet is now controlled (`open={open} onOpenChange={handleOpenChange}`); the handler intercepts ALL dismiss paths (outside-click, Escape, X, programmatic) and shows a `<ConfirmDialog>` with "Discard" / "Keep editing" when dirty. A `forceClose` boolean bypasses the check after a successful Save or after the user explicitly Discards.
- **Missing `npm run supabase:gen-types` script** added to `package.json` (continuation of the Session 1.5 noted gap).

### Decided (non-obvious)

- **Idempotent seed pattern**: every junction insert keys off natural-key lookups (book by title, person by `last_name + first_name`, category by slug). Never depend on `RETURNING` from a same-statement insert that may have been deduped. This is now codified as a gotcha in [`.cursor/rules/db-changes.mdc`](../../.cursor/rules/db-changes.mdc).
- **Confirm-dialog over auto-save**: auto-save on dismiss could commit half-filled invalid forms (no title, malformed authors); the confirm flow keeps the user in control and matches the existing destructive-action pattern.
- **`forceClose` flag over snapshot re-baselining alone**: when Discard fires, we set `forceClose = true` then `open = false`. The next `handleOpenChange(false)` call sees forceClose, skips the dirty check, and commits the close. This is more legible than relying on Svelte's $derived recomputation timing after re-baselining the snapshot.
- **Primary category default stays blank** (Session 1.5 decision preserved) — but the Save button no longer blocks on it.
- **Snapshot serialization via `JSON.stringify`** captures all 27 fields + the author rows array. ~30 lines vs a per-field touch handler — readable and accurate enough for a single-form use case.

### New components / patterns added

- **Pattern: idempotent seed re-attaches via natural-key lookup** — see [`supabase/seed/library_smoke_data.sql`](../../supabase/seed/library_smoke_data.sql) for the canonical shape.
- **Pattern: dirty-form confirm via controlled `<Sheet>`** — captured in [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc). Reusable for any future entity form sheet (TimeEntrySheet could adopt it, ClientFormSheet too).

### Schema changes

- [`20260428160000_books_primary_category_nullable.sql`](../../supabase/migrations/20260428160000_books_primary_category_nullable.sql) — `books.primary_category_id` becomes nullable. Applied 2026-04-28.

### Open questions surfaced

- **Why did existing-book authors disappear during the user's testing?** Most likely cause is the smoke-seed re-runs (where the books pre-existed and the junctions failed to re-attach). The form's edit path with `<PersonAutocomplete>` doesn't drop authors silently — the diff-based `syncAuthors` only removes rows the user explicitly removed. If the user sees this again specifically during edit-flow (not after re-running smoke seed), that's a separate diagnostic worth opening.
- **Detail view `(uncategorized)` is one of two empty states**: it's distinct from "no other categories" rendered as `'—'`. Could pick one convention (italic vs em-dash) for both. Deferred until more empty-state patterns surface.

### Surprises (read these before the next session)

9. **`bind:open` on `<Sheet.Root>` cannot be intercepted** — to inject a confirm step on dismiss, switch to controlled `open={open} onOpenChange={handleOpenChange}`. The handler can `return` without committing the close, which keeps the sheet open. All dismissal paths (outside-click, Escape, X) funnel through `onOpenChange`. Same will be needed for any entity sheet that wants the dirty-form pattern.
10. **`primary_category_id` was the only `NOT NULL` user-facing FK on books** — making it nullable did NOT require a backfill (every existing row had a value), but it did change the `Database['public']['Tables']['books']['Row']['primary_category_id']` type from `string` to `string | null`. Any consumer that destructured to `string` would break. The form sheet's `book.primary_category_id` assignment now needs `?? ''` because the form state is `string` (empty = unset).

### Carry-forward updates

- [x] `supabase/seed/library_smoke_data.sql` rewritten for re-runnability + 15 books.
- [x] `20260428160000_books_primary_category_nullable.sql` applied; types regenerated.
- [x] `.cursor/rules/db-changes.mdc` — idempotent-seed gotcha appended.
- [x] `.cursor/rules/library-module.mdc` — dirty-form-confirm pattern appended.
- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 1 acceptance line annotated for the relaxed primary-category requirement.
- [x] No new env vars introduced.

## Session 1.5c hotfix + nullable-everything (2026-04-28)

User testing surfaced a critical regression and validated the broader design intent: the form was unusable (typing/Add author/X did nothing), Save disabled provided no guidance, and the user wanted the Add Book flow to support "scan barcode now, fill in details later" — i.e. *any* book field should be skippable, with auto-flag-for-review when important identifying fields are missing.

### Built

- **Form-reset $effect bug fixed** in [`src/lib/components/book-form-sheet.svelte`](../../src/lib/components/book-form-sheet.svelte). The Phase C open-effect from Session 1.5b called `currentFormSnapshot()` directly, which reads all 27 form `$state` vars; Svelte 5 `$effect` tracks every state read inside its body, so each keystroke / Add-author click triggered the effect to re-fire and reset the form back to its initial seed state. Fix: wrap the snapshot capture in `untrack(() => currentFormSnapshot())` from `svelte`. Effect now only re-runs when `open / mode / book` actually change.
- **Schema**: [`supabase/migrations/20260428170000_books_title_genre_nullable.sql`](../../supabase/migrations/20260428170000_books_title_genre_nullable.sql) drops `NOT NULL` on `books.title` and `books.genre`. Applied; types regenerated.
- **Parser rewrite** in [`src/lib/library/server/book-actions.ts`](../../src/lib/library/server/book-actions.ts):
  - `BookFormPayload.title` / `.genre` are now `string | null` and `Genre | null`.
  - `parseBookForm` no longer errors on empty title; genre validates the GENRE_SET only when non-empty.
  - **Save bar** replaced: parser checks `hasAnyField` against the full set of identifying scalars + relations, and 400s with "Add at least one detail (title, ISBN, an author, anything) before saving." when literally nothing is set.
  - **Auto-flag-for-review** logic: new `IMPORTANT_FIELDS = ['title', 'author', 'genre', 'year', 'publisher']` constant + `computeMissingImportant(...)` helper. When any are missing, the parser forces `needs_review = true` and merges a "Missing: title, year, publisher" auto-line into `needs_review_note` via `mergeReviewNote(...)` — preserving any user-written note by prepending the auto-line.
- **Form sheet UI** ([`src/lib/components/book-form-sheet.svelte`](../../src/lib/components/book-form-sheet.svelte)):
  - Title label drops the asterisk; gets a "Optional — fill in later if unknown" hint.
  - Genre Select gets a `— None —` top option; label drops the asterisk.
  - Save disable logic: `disabled={pending || !hasAnyField}`, where `hasAnyField` is a `$derived` mirroring the server-side check.
  - When Save is disabled-due-to-empty: muted hint "Add at least one detail (title, ISBN, an author, anything) before saving."
  - When Save is enabled but `missingImportantPreview.length > 0` and `!needs_review`: amber hint "Will be auto-flagged for review (missing: title, year, publisher)." Mirrors the server's `computeMissingImportant`.
- **Untitled fallbacks** across UI:
  - List view (mobile cards + desktop table) renders `<span class="italic text-muted-foreground">(untitled)</span>` when `title` is null. Genre chip only renders when non-null.
  - Detail page `<h1>` falls back to `(untitled book)` italic; `<title>` head shows `(untitled) — Library — ppp`; genre chip in header is conditional.
  - Title sort key handles null (sorts to top).
- **Audit log entity label**: `entityLabelFor('books', record_id, ...)` falls back to `Untitled book #${record_id.slice(0, 8)}` when title is null/empty, so the audit row is still identifiable.
- **Diagnostic file** [`supabase/diagnostics/library_authors_check.sql`](../../supabase/diagnostics/library_authors_check.sql) with three paste-ready queries (counts, per-book listing with person.deleted_at, orphan check) to triage the still-blank Authors column from Issue 1. Read-only; safe to run anytime.

### Decided (non-obvious)

- **Important-fields list = title, author, genre, year, publisher.** All five are citation-critical. Intentionally NOT including ISBN (older books may not have one) or primary_category (already nullable; user-deferred classification).
- **Auto-flag merge rule for needs_review_note**: if existing note is empty OR matches `/^Missing:\s/` (a previous auto-line), replace. Otherwise prepend the new auto-line + blank line + existing note. Preserves user-authored notes while keeping the auto-line in sync as fields are filled in.
- **Save bar is "any field"**, not "any *important* field". Even a personal_notes-only entry ("the green book on my shelf") is savable — auto-flag will list everything as missing, but the row exists for later refinement.
- **Display-layer untitled handling** vs. database-side default. We could have set `title DEFAULT '(untitled)'`, but that would force the literal string into queries and cause noise on Sort. Storing NULL + rendering `(untitled)` italic at every read site keeps the data clean.

### New components / patterns added

- **Pattern: untrack the snapshot capture in dirty-form $effects.** Documented in [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc). Any future entity form sheet that snapshots state in an open-effect MUST wrap the snapshot read in `untrack(() => fn())` or every form-field change will re-fire the effect.
- **Pattern: auto-flag-for-review at the server-side parser.** Computes `missingImportant`, forces `needs_review=true`, merges auto-note. Sister method `computeMissingImportant` is exported so the form sheet's amber preview hint stays in sync.
- **Pattern: `hasAnyField` save bar** — for forms where every field is optional, require at least one non-default value at parse time. Avoids accidental empty inserts without requiring any specific field.

### Schema changes

- [`20260428170000_books_title_genre_nullable.sql`](../../supabase/migrations/20260428170000_books_title_genre_nullable.sql) — `books.title` and `books.genre` become nullable. Applied 2026-04-28.

### Open questions surfaced

- **Issue 1 (still-blank Authors column) NOT diagnosed yet.** The diagnostic file in this round gives the user the queries to identify which of three failure modes is in play; fix lands in a follow-up round once the data state is known.

### Surprises (read these before the next session)

11. **Svelte 5 `$effect` tracks ALL state reads in the body** — including reads inside helper functions called from the body. The Session 1.5b open-effect called `currentFormSnapshot()` (which reads 27 form vars), making every form-field change re-fire the effect, which immediately reset the form. Fix is `untrack(() => currentFormSnapshot())`. Lesson for future entity sheets: when capturing snapshots inside an effect, untrack is mandatory.
12. **`let needs_review = $state(false)` infers literal type `false`**, not `boolean`. The `hasAnyField` derived's `needs_review === true` comparison failed type-check ("types `false` and `true` have no overlap") until widened to `$state<boolean>(false)`. Pattern for any boolean state that may flip true via user interaction: annotate the type explicitly.

### Carry-forward updates

- [x] Migration `20260428170000_books_title_genre_nullable.sql` applied; types regenerated.
- [x] `.cursor/rules/library-module.mdc` — untrack note + auto-flag-for-review pattern appended.
- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 1 acceptance line annotated for the nullable-everything model.
- [x] No new env vars introduced.

## Session 1.5d recovery + autocomplete chip mode (2026-04-28)

The diagnostic queries from Session 1.5c immediately surfaced the root cause of the still-blank Authors column: **`people.deleted_at` and `series.deleted_at` had never actually been added to prod**, even though the SQL was sitting in [`20260425160000_library_delta_v1.sql`](../../supabase/migrations/20260425160000_library_delta_v1.sql). Plus the user reported the `<PersonAutocomplete>` "doesn't stick / shows weird" — which is partly the empty-people consequence of the schema bug AND a real UX gap in the selected-state rendering.

### Built

- **[`supabase/migrations/20260428180000_people_series_deleted_at_recovery.sql`](../../supabase/migrations/20260428180000_people_series_deleted_at_recovery.sql)** — `ALTER TABLE public.people / series ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`. Idempotent. Pushed and types regenerated. After application, `loadPeople` / `loadSeries` queries succeed; the list view's Authors column repopulates and series chips + tooltips appear.
- **[`<PersonAutocomplete>`](../../src/lib/components/person-autocomplete.svelte) chip-mode redesign**. Two visual modes:
  - **Chip mode** (default when `value !== null`): a button-styled chip displays the selected person's full name + a "Change" affordance, with a separate X button for clearing. Click the chip → switch to search mode.
  - **Search mode** (when `value === null` OR user clicked Change): the existing input + dropdown. If a person was previously selected, a small "Cancel" overlay button restores the chip without losing the value.
  - **`$effect` watching `value`**: when `value` transitions to non-null (in-component selection OR externally set after a Create dialog), automatically exit search mode + clear `queryRaw` + close dropdown. Uniform for both selectPerson and create-flow code paths.
  - Dropped the placeholder-as-selected-label hack from Session 1.5; selected state is now visually unmissable.

### Decided (non-obvious)

- **Recovery migration vs editing the existing file**: had to write a new file. Supabase tracks applied migrations by filename in `supabase_migrations.schema_migrations` and silently skips on re-push. There's no "re-apply" option short of removing the row from that table (destructive and risky against prod). New file with `IF NOT EXISTS` guards is the clean idempotent recovery path.
- **Chip mode + separate X button** (rather than a single chip with an inline-clear icon). Two distinct affordances — Change is the common case (re-search), X is the rare case (truly remove). Visually parallel.
- **Cancel button in search mode** (when value pre-existed): exits the search without committing a new pick. Lets the user explore the list, then back out without changing what was already selected.

### New components / patterns added

- **Pattern: chip-mode for typeahead pickers with selected state**. The chip-vs-input-vs-button-overlay design pattern was tried in Sessions 1.5b/c with the placeholder-as-label hack and was confusing. Chip mode is the canonical pattern for `<PersonAutocomplete>` and the future `<CanonicalizingCombobox>` (Session 5). When you have a value AND an interactive search field, hide the search field by default and surface it explicitly via Change.
- **Pattern: `$effect` watching a $bindable prop's value transitions**. Use a `prevValue` $state to detect transitions; reset internal component state when the prop changes from null → set. Avoids feedback loops between the prop binding and internal state.

### Schema changes

- [`20260428180000_people_series_deleted_at_recovery.sql`](../../supabase/migrations/20260428180000_people_series_deleted_at_recovery.sql) — adds `deleted_at` to `people` and `series` (idempotent). Applied 2026-04-28.

### Open questions surfaced

None. The Authors column blank, series tooltip blank, and `<PersonAutocomplete>` UX issues all collapse into the recovery migration + chip redesign.

### Surprises (read these before the next session)

13. **Supabase migrations are immutable by filename.** When you `supabase db push` a migration file, Supabase records the filename in `supabase_migrations.schema_migrations`. Subsequent pushes that include the same filename — even with edited SQL inside — are silently skipped. This is intentional (idempotency / reproducibility) but bites HARD when you amend a migration after first applying it: the new SQL never runs against any environment that already saw the original version. The `library_delta_v1.sql` amendments to add `people.deleted_at` and `series.deleted_at` (Session 1.5b Track 0) silently no-op'd on prod for this reason. Lesson: NEVER edit a deployed migration. Write a new file with idempotent guards. This is now codified in [`.cursor/rules/db-changes.mdc`](../../.cursor/rules/db-changes.mdc).

### Carry-forward updates

- [x] Migration `20260428180000_people_series_deleted_at_recovery.sql` applied; types regenerated.
- [x] `.cursor/rules/db-changes.mdc` — "Migrations are immutable" workflow note added.
- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 1.5d annotated.
- [x] No new env vars introduced.
