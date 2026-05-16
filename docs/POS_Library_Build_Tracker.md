# Personal Operations System — Library Module Build Tracker

> **Read these before any session — the tracker assumes they are loaded.**
>
> - `AGENTS.md` — carry-forward inventory, env vars, decision-record template, quality gates
> - `docs/POS_Library_Session_0.md` — **prereq**; this tracker is canonical only after Session 0 acceptance
> - `docs/decisions/000-invoicing-retro.md` — schema gaps, RLS surprises, component patterns from invoicing
> - `docs/decisions/001-audit-log-ui.md` — `_LIBRARY_TABLES` whitelist will need updates as new tables ship
> - `.cursor/rules/always.mdc`
> - `.cursor/rules/db-changes.mdc`
> - `.cursor/rules/sveltekit-routes.mdc`
> - `.cursor/rules/edge-functions.mdc`
> - `.cursor/rules/components.mdc`
> - `.cursor/rules/library-module.mdc`
>
> Standards live in those files; the tracker is the plan. Where this tracker would otherwise restate a standard, it links instead.

_Last updated: May 16, 2026 | Module: Library (2nd) | **Pre-trip target: late May 2026 (sermon-prep-ready)** | **Post-trip target: late August 2026 (Turabian + fall-semester-ready)**_

**Trip QA + viewer closure:** Step-by-step phone + viewer script → [docs/library-trip-qa-runbook.md](library-trip-qa-runbook.md). Tick acceptance rows after hands-on verification; repo gate `npm run check` passed 2026-05-16 (Session 9 OCR continuation).

---

## Critical Path — Reframed

The trip changes the deadline geometry:

- **Pre-trip checkpoint (late May):** library is **research-ready** for summer sermon prep. Search-first surface lights up. Turabian polish and **shelf-bound** academic QA are not pre-trip blockers.
- **10-week away period (late May → early August):** library is in active use for sermon prep + light academic reading. **Build is allowed** during the trip (OCR, schema/UI/Edge, mobile polish, Session 8 pure-function citation prep) — see **Trip Period** below. **Shelf-bound work is deferred:** only ~200 scholarly-core books travel; anything that needs an arbitrary physical volume from the full ~1,288 (Pass 2 review drill-down, shelf spot-checks, BDAG / Calvin CC vols 2–3 / Bruce NICNT Acts / Hodge 1 Cor / Douglas *NBD* checks) waits until **August**.
- **Post-trip checkpoint (late August / early September):** finish shelf-bound Pass 2 + importer QA; Turabian + Turabian-first `/library/review` (Session 8) toward fall-semester-ready citations. Session 7 **shipped 2026-05-02**.

The September seminary start was the original hard deadline. With Turabian moved post-trip, the **real** pre-trip hard requirement is "sermon-prep-ready" — passage search returns the right commentaries, and book-level metadata is trustworthy enough to copy/paste into a manual citation when needed.

Pre-trip arc: **7 sessions** (1 → 2 → 3 → 4 → 5 → 5.5 → 6) in ~10 working days. **Trip-period + post-trip arc:** Session 7 shipped; **Session 9 (OCR)** and **Session 8 (Turabian)** may proceed during the trip for non-shelf work; sequence stays **7 → 9 → 8** for citation dependencies; **Session 4 Pass 2** (spreadsheet re-import) stays **August** (shelf + v2 sheet).

---

## Pre-Session Checklist

- [ ] **`docs/POS_Library_Session_0.md` complete** — schema audit signed off, Open Questions ≤ 2 unresolved per entity, viewer seeded with curl proof, decision points 5a–5d locked. _(Audit doc filed at `docs/decisions/002-library-session-0-audit.md`; viewer seed pending Round 2 UUID paste-in.)_
- [x] Decision points locked (per the Session 0 doc, with this tracker's choices):
  - **5a (OCR):** schema hooks shipped pre-trip (`source_image_url`, `confidence_score`, `needs_review`); **Anthropic Edge path shipped 021** (trip-period build allowed). Ingest still user-confirmed via batch save. See `docs/decisions/005-scripture-refs-bulk-and-ocr-design.md`.
  - **5b (ancient_texts canonicalization):** seed canonical list in Session 0; inline `<CanonicalizingCombobox>` in Session 5; Settings CRUD page in Session 7.
  - **5c (component naming):** `<SourcePicker>` for polymorphic `(book_id OR essay_id)`; `<CanonicalizingCombobox>` for `ancient_texts.canonical_name + abbreviations[]` and `book_topics.topic` autocomplete. Names registered in `.cursor/rules/components.mdc`.
  - **5d (Session 1 scope):** books CRUD + people junctions + categories + series — full vertical slice with junctions, not books-alone.
- [x] Scholarly core review complete in Claude — corrections absorbed into the v2 spreadsheet that landed directly in prod May 2026 (database now source of truth per Q8 resolution).
- [x] Deferred shelf-check items resolved — Calvin CC vols 2 & 3, Bruce NICNT Acts edition, Hodge 1 Cor reprint, Douglas *New Bible Dictionary* edition — owner has shelf access; outstanding gaps live as `needs_review = true` rows for `/library/review` triage rather than as pre-session blockers.
- [x] BDAG migration row drafted — absorbed into v2 spreadsheet upload; importer path retired per Q8.
- [x] `enrich_library.py` run against the scholarly core — Pass 1 enrichment 2026-04-30 (Q2 resolution); v2 spreadsheet picked up corrections directly.
- [x] `@zxing/browser` device smoke — implementation + manual fallback shipped Session 6; confirm on your phone when convenient (`docs/decisions/011-library-session-6-mobile-and-barcode.md`).
- [x] Turabian skill (`SKILL.md` + `formats.md`) — **complete in Claude.ai** (owner 2026-05-06). Session 8 still implements citation generation in-app; skill remains the QA reference (`formats.md`).
- [x] Invoicing module complete — carry-forward inventory in `AGENTS.md` verified.

---

# Pre-Trip Arc — Sermon-Prep-Ready

_Ends with: passage search works against ~1,288 books, mobile scripture-reference entry is friction-free, book CRUD + barcode add are in your pocket. Citations are still manual; the trip-period workflow is "find → read → enter references" not "find → cite."_

---

## Session 1 — Books + People + Categories + Series Vertical Slice (4–5h)

_Goal: First real CRUD surface ships with junctions. Library's primary entity (`books`) lands with full author + category + series wiring so seed data and migration in Session 4 have somewhere to land. Per Session 0 decision 5d._

| Task | Done | Notes |
|------|:----:|-------|
| Apply `library_delta_v1.sql` migration (queued in Session 0) to staging then prod | ☑ | Applied 2026-04-25 via `supabase db push`. Bundled with `20260425170000_books_viewer_column_protection.sql` (Track D B1/B2 trigger), `20260425180000_search_scripture_refs.sql` (Session 2 SQL function), and `20260425190000_audit_log_composite_pk_fix.sql` (junction-table audit fix surfaced by smoke seed — see `docs/decisions/003-library-books-vertical-slice.md` Surprise #6). Types regenerated in follow-on commits. |
| Apply `library_seed.sql` (queued in Session 0) — viewer `user_permissions` + `bible_books` seed + `categories` seed + initial `ancient_texts` seed (Josephus, Philo, Apostolic Fathers, Apocrypha) + initial `series` records (ICC, NTC, OTL, EKK, TWOT, AB, MH, COT) | ☑ | Applied 2026-04-25 via Studio SQL editor. Plus `library_smoke_data.sql` (5 realistic books with full junctions) and `library_scripture_fixture.sql` (20 refs) for end-to-end verification. Viewer permissions block still commented out (intentional — solo use until a collaborator joins, per Session 1.5 decision). |
| `/library/+page.server.ts` + `/library/+page.svelte` — list view with title, genre, reading_status badge, needs_review badge. No filters yet (Session 3). | ☑ | Route conventions per `.cursor/rules/sveltekit-routes.mdc`. Mobile cards / desktop table. |
| `/library/books/[id]` — detail view with hydrated authors (roles + sort_order), categories, series + volume_number | ☑ | JOINs in load function via shared `loadBookDetail` helper. |
| `<BookFormSheet>` — create + edit, all `books` fields. Reuse `<TimeEntrySheet>` pattern (`entity == null` = create). | ☑ | Per `AGENTS.md` form-action result shape. Registered in `.cursor/rules/components.mdc`. |
| People autocomplete + inline create — last_name + first_initial match, B14 dedup prompt ("Person exists: J. Smith (3 books). Use existing or create new?") | ☑ | Inline person-create dialog via `fetch + deserialize`; B14 hint inline (full `<CanonicalizingCombobox>` is Session 5). `aliases` ChipsEditor deferred until people CRUD page (Session 7). |
| `book_authors` junction UI — row per author with role (author/editor/translator) and sort_order. Drag-reorder. | ☑ | Up/down arrow reorder (mobile-friendly). Edit flow diff-based per `syncAuthors` in `book-actions.ts`. |
| `book_categories` junction UI — multi-select; primary = first selected → `books.primary_category_id` | ☑ | Primary picker drives `primary_category_id`; chip toggles add extras. Diff-based via `syncCategories`. |
| Series picker — autocomplete by name or abbreviation; inline create | ☑ | Series Select with abbrev + name labels. Inline series-create deferred to Session 7 settings page. |
| Soft-delete with 10s undo toast | ☑ | `softDeleteBook` + `undoSoftDeleteBook` actions, toast on detail page. |

**Acceptance:**
- [x] Schema delta applied to prod (delta v1 + viewer-column trigger + audit composite-PK fix all applied via `supabase db push`).
- [x] Owner can list → view → create → edit → soft-delete → undo a book end-to-end on desktop and phone — owner smoke 2026-05-16.
- [x] Add a new book with 2 authors (different roles), 3 categories (1 primary), series + volume → 2 `book_authors` rows, 3 `book_categories` rows, `series_id` + `volume_number` populated — owner smoke 2026-05-16. _Note: `book_categories` junction is retired by docs/decisions/022-library-category-removal.md; this row reflects the original Session 1 contract._
- [x] Edit flow: remove 1 author, add 1 editor, reorder remaining → junction rows reflect exactly the new state; audit log shows 1 DELETE + 1 INSERT + N UPDATEs — owner smoke 2026-05-16.
- [x] B14 canonicalization combobox prompt fires when creating a person whose last_name + first_initial match an existing person — owner smoke 2026-05-16.
- [x] No hand-written DB types in `src/`. Grep for `type Book = {` returns zero hits.
- [x] `npm run check` passes
- [x] `npm run supabase:gen-types` ran and `src/lib/types/database.ts` reflects post-delta-v1 columns. (Phase 0 of Session 1.5 also reverted the `// TODO post-delta-v1` compat shims.)
- [x] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template (`002-library-session-0-audit.md` + `003-library-books-vertical-slice.md`, with Session 1.5 polish appended to 003).
- [ ] viewer can INSERT books with junctions and UPDATE `reading_status`; viewer cannot UPDATE `personal_notes` / `rating`; viewer cannot DELETE; viewer can full-CRUD on people + series + junctions but cannot merge people (Session 7) — _deferred: solo use until a collaborator joins. B1/B2 trigger ships in `20260425170000_books_viewer_column_protection.sql` so the security guarantee is in place; the test runs when a viewer auth user exists_.

**Session 1.5 polish sweep (2026-04-28)** — see `docs/decisions/003-library-books-vertical-slice.md` for full details. Shipped: `<PersonAutocomplete>` typeahead, shadcn Dialog wrap (fixes outside-click data loss), pre-flight B14 warning, detail-page delete redirect with 10s undo toast on list, inline reading_status edit (list + detail), article-stripped sort, full first-name author display, series hover tooltip, blank primary-category default, audit-log soft-delete display + revert + entity name. `package.json` `supabase:gen-types` script added (was missing).

**Session 1.5b follow-ups (2026-04-28)** — same decision record. Shipped: smoke seed re-runnable (junctions look up books by title) + 10 more books (15 total), `books.primary_category_id` made nullable (migration `20260428160000_books_primary_category_nullable.sql`), dirty-form confirm dialog on `<BookFormSheet>` dismissal (Sheet now controlled with onOpenChange interceptor). Primary category is no longer required at create time — leave as "— None —" if uncertain.

**Session 1.5c hotfix + nullable-everything (2026-04-28)** — same decision record. Shipped: form-reset `$effect` bug fixed via `untrack` (was wiping all input on every keystroke); `books.title` and `books.genre` made nullable (migration `20260428170000_books_title_genre_nullable.sql`); auto-flag-for-review pattern at the server parser — when title/author/genre/year/publisher missing, `needs_review=true` is forced and a "Missing: …" auto-line is merged into `needs_review_note`; `hasAnyField` save bar replaces "title required"; list/detail/audit fallbacks render `(untitled)` italic / `Untitled book #abc12345`; diagnostic file `supabase/diagnostics/library_authors_check.sql` for the still-blank Authors column.

**Session 1.5d recovery + autocomplete chip mode (2026-04-28)** — same decision record. Diagnosed the still-blank Authors column as missing `people.deleted_at` and `series.deleted_at` columns — the amended `library_delta_v1.sql` from Session 1.5b Track 0 was silently skipped by Supabase (filename already in `schema_migrations`). Shipped: recovery migration `20260428180000_people_series_deleted_at_recovery.sql` (idempotent `IF NOT EXISTS`); types regenerated; **Authors column + series chips/tooltips now populate correctly**. `<PersonAutocomplete>` redesigned with a chip-mode selected state (button-styled chip + Change + X) — no more placeholder-as-label hack. New `Surprise #13` documented in the decision record + new "Migrations are immutable by filename" workflow note added to `.cursor/rules/db-changes.mdc` so we don't burn time on this again.

**Session 1.5e book form promoted to dedicated pages (2026-04-28)** — same decision record. The `<BookFormSheet>` was structurally too cramped for a 30-field form (sheet caps at `max-w-2xl`, causing dropdown-name wrap, "— Nor..." truncation, and the autocomplete Cancel button colliding with the placeholder). Shipped: extracted form body into a presentational `<BookForm>` component; new `/library/books/new` and `/library/books/[id]/edit` routes (max-w-5xl, breadcrumb back, 2-col desktop layout); author row redesigned (Person on its own line, lighter chrome, chevrons hidden when single); `<PersonAutocomplete>` Cancel-overlap fix (`pr-20` on input when value is set); list/detail "Add book" + "Edit" entry points become `<a>` links; `createBook` / `updateBook` actions trimmed off list/detail pages (now live in dedicated routes); dirty-form interception via SvelteKit `beforeNavigate` (covers back/breadcrumb/link click — strictly more coverage than the controlled-Sheet `onOpenChange` it replaces); `<BookFormSheet>` deleted. New rules: "Large entity forms ship as dedicated pages, not sheets" + "Dirty-form confirm via `beforeNavigate` (page-hosted forms)" in `.cursor/rules/library-module.mdc`.

**Session 1.5f author quick-create + form polish (2026-04-28)** — same decision record. Shipped: smart `parseTypedName` parser supports "Last, First Middle" (comma-flip) and middle-initial detection ("John Q. Smith" → first=John, middle=Q, last=Smith); new `onAutoCreate` callback on `<PersonAutocomplete>` fires on blur when typed text doesn't match anyone, triggering a silent person-create (no dialog) — the explicit "+ Create" dropdown row stays for users who want the confirmation modal; author row collapses back to a single horizontal row (autocomplete flex-1, Role w-40, chevrons + X) now that the form has the page-width room; removed redundant "Optional —" help text under Title and Primary category. The B14 collision warning still surfaces inline below the row after auto-create so accidental duplicates are visible.

**Session 1.5g author auto-create gate fix + default search row (2026-04-28)** — same decision record. The Session 1.5f auto-create-on-tab-away never actually fired because the gate in `<PersonAutocomplete>.handleBlur` used strict `value === null` while `<BookForm>` seeds new author rows with `person_id: ''` (empty string). Empty string is not null → silently no-op every time. Fixed: changed the gate to `!value` (matches the rest of the file's truthy-check convention). Plus seeded one empty author row by default in `<BookForm>` so the search input is visible immediately without clicking "Add author"; removed the now-redundant "No authors yet" empty-state paragraph. New Surprise #16 documented: `$bindable` string-or-null props need a falsy `!value` check, not strict `value === null`, when the host seeds with empty string.

**Session 1.5h BookForm seed-effect re-run hotfix (2026-04-28)** — same decision record. User reported being "stuck" on the edit page after Session 1.5g (URL would update on back-link clicks but the page wouldn't render, and typed field changes were vanishing). Root cause: the seed-if-empty block I added in 1.5g read `authorRows.length` directly, which Svelte 5's `$effect` tracks as a dependency. Result: the entire seed effect re-ran on every author add/remove/auto-create reassignment, re-pre-filling all fields from `book` (wiping user input in edit mode) and re-baselining `initialSnapshot` (silently flipping `dirty` back to false), which confused the page-level `beforeNavigate` interceptor. Fix: wrap the length check in `untrack(() => authorRows.length === 0)` — same shape as the Session 1.5c snapshot fix. New Surprise #17 documented: any state read inside an init/seed `$effect` body — even a `.length` probe — adds it to the dep set and re-fires the effect.

**Session 1.5i note: author management UI deferred (2026-04-28)** — the inline `<PersonAutocomplete>` + dialog quick-create makes adding authors frictionless, but there's still no surface to **review, rename, delete, or merge people** that get created during quick-create flows. Friction will accumulate as the library grows: typos, near-duplicates that slip past the B14 dedup hint, and people created against the wrong book. Owner of the fix: **Session 7** (`/settings/library/people`) — the merge action is already in scope; this note bumps "list + edit + soft-delete on existing rows" up to first-class scope alongside merge. Until then, fixes have to happen via Supabase Studio.

**Session 1.5j hotkey label gap + registry tightening (2026-04-28)** — separate decision record (`005-app-wide-hotkeys.md`). Surfaced two issues: (1) the underline-mnemonic `<HotkeyLabel>` rendered "S ave book" with a visible inter-letter gap because `<span class="contents">` re-exposed text/`<u>`/text as flex children of the Button's `inline-flex gap-1.5`. Fix: drop `display: contents`, use a plain `<span>`. (2) `Cmd+N` is non-reclaimable in Chrome — the registered `n` (new) hotkey didn't suppress the new-window. Tightened the registry; explicit avoid-list now covers the full set of browser/OS reserved letters AND clipboard / select-all / undo collisions inside text inputs. Anchor `<Button href>` no longer triggers the dev warn. See `.cursor/rules/hotkeys.mdc` for the updated reserved-letter table.

**Session 1.5k Esc-for-Cancel + b-for-New-Book replacements (2026-04-28, verified working)** — same decision record (`005-app-wide-hotkeys.md`). The trimmed registry from 1.5j left "New book" and every Cancel button without a hotkey. Closed the loop by adding two replacements: (1) `<Button hotkey="b">` for "New **B**ook" — `b` was already on the safe-letter list (Cmd+B = bookmarks bar in Chrome, reclaimable), and the second-letter-of-label mnemonic reads naturally; (2) `<Button hotkey="Escape">` for all 7 Cancel buttons (confirm-dialog, default-cc-dialog, book-form person dialog, library/books/new, library/books/[id]/edit, scripture-reference-form, invoice send dialog). Required adding Escape special-key support to the shortcut action: bare Esc with no modifier, listens on the **bubble** phase (Mod+letter listens on capture), bails on `event.defaultPrevented` so a focused widget that handles Esc itself (open `<PersonAutocomplete>` dropdown) wins the keystroke. Tooltip on Cancel reads "Esc"; underline is intentionally absent (no letter in "Cancel" matches "Escape"). Hands-on smoke: Cmd+B opens new-book page, Esc closes any modal, Esc inside an open autocomplete dropdown closes the dropdown only.

---

## Session 2 — `scripture_references` + `<SourcePicker>` + Overlap Search SQL (3–4h)

_Goal: Polymorphic `(book_id OR essay_id)` shape designed once, as a shared component, per `.cursor/rules/library-module.mdc`. Overlap-search SQL function lands against fixture data. The Session 3 search UI depends on this; getting it right here means Session 3 just wires UI to a working query._

**Shared artifacts produced this session (reused in Session 5):**
- `PolymorphicParent` TypeScript type: `{ kind: 'book'; book_id: string } | { kind: 'essay'; essay_id: string }`
- `<SourcePicker>` component (book branch active; essay branch behind `FEATURE_ESSAYS_UI` flag, unreachable but compiled)
- `insertPolymorphicRow<T>(table, data)` — validates XOR at app layer

| Task | Done | Notes |
|------|:----:|-------|
| Build `PolymorphicParent` type + Zod validator at `src/lib/library/polymorphic.ts` | ☑ | Shipped Session 1.5 / Track E. Discriminated union, `validateXor`, `polymorphicToColumns`, `insertPolymorphicRow<T>`. File header lists the four reuse-target tables and the `FEATURE_ESSAYS_UI = false` gate. |
| Build `<SourcePicker>` — book autocomplete; essay branch stubbed with disabled state | ☑ | Shipped Session 1.5 / Track E. Registered in `.cursor/rules/components.mdc`. Supports `lockedBookId` for the host-page-locked case. |
| `<ScriptureReferenceForm>` on book detail — wraps `<SourcePicker>` (auto-populated to current book); fields: bible_book, chapter_start, verse_start, chapter_end, verse_end, page_start, page_end, needs_review, review_note, source_image_url (manual upload, no OCR) | ☑ | Wired into `/library/books/[id]` Session 2 (2026-04-28). Per-row inline-toggle Edit, ConfirmDialog-gated soft-delete with optimistic remove, refs grouped by `bible_book` in canon order. Image upload via browser supabase client → `library-scripture-images` bucket (Open Question 3 resolved); object path stored, signed URL (1h TTL) generated server-side per load. **2026-04-29 follow-up:** form rebuilt as batch-capable (N draft rows, shared image, "Save N references" submit) backed by `?/createScriptureRefsBatch`. Edit mode is now the degenerate single-row case. OCR/file-extraction designed as feeding the same batch surface; implementation deferred to post-trip session — see [`docs/decisions/005-scripture-refs-bulk-and-ocr-design.md`](../docs/decisions/005-scripture-refs-bulk-and-ocr-design.md). |
| Verify `compute_verse_abs` trigger fires on INSERT and on UPDATE of any chapter/verse column | ☑ | Diagnostic at [`supabase/diagnostics/library_compute_verse_abs_update_path.sql`](../supabase/diagnostics/library_compute_verse_abs_update_path.sql). Original Step 4 surfaced a bug: `chapter_start` with no `chapter_end` produced `verse_end_abs = 999999` (open-ended) instead of `chapter*1000+999` (chapter only). Fixed in [`supabase/migrations/20260429180000_compute_verse_abs_chapter_only_fix.sql`](../supabase/migrations/20260429180000_compute_verse_abs_chapter_only_fix.sql) — function rewritten + every live row recomputed via `UPDATE … SET chapter_start = chapter_start`. Diagnostic now asserts INSERT baseline + 5 UPDATE paths (verse_start toggle, chapter_end+verse_end set, collapse to chapter-only, chapter-range, collapse to whole-book). _User runs this once in Studio post-deploy._ |
| Write `search_scripture_refs(p_bible_book TEXT, p_chapter INT, p_verse INT)` SQL function | ☑ | Shipped Session 1.5 / Track E in `20260425180000_search_scripture_refs.sql`. SECURITY INVOKER + GRANT EXECUTE. Inclusive overlap; manual entries first per S7. |
| Seed fixture: 20 scripture_references across 5 books (verse-level, chapter-level, whole-book, multi-chapter) | ☑ | Shipped at `supabase/seed/library_scripture_fixture.sql`. Loaded 2026-04-25; verified live via `search_scripture_refs('Philippians', 2, 5)`, `('Romans', 8, 28)`, `('Mark')` in Studio. |
| Integration test — `search_scripture_refs('Philippians', 2, 5)` returns the 3 expected fixture rows | ☑ | Verified live. (Predicted-row counts in the fixture comments are slightly off vs the actual fixture data — cosmetic; rows return correctly.) |
| Image upload to Supabase Storage private bucket for `source_image_url` | ☑ | Bucket `library-scripture-images` (private, 10 MB cap, jpeg/png/webp/heic) shipped in `20260428200000_library_scripture_images_bucket.sql`. Path convention `${userId}/${bookId}/${ulid}.${ext}` with first-segment self-prefix INSERT check. Signed URLs (1h TTL) generated server-side in `loadScriptureRefsForBook`. Client-side downscale (~2048px JPEG @ q=0.85) before upload. **Manual upload only** — OCR is Session 9. |

**Acceptance:**
- [x] `<SourcePicker>` component exists and is documented in `src/lib/library/polymorphic.ts` with the four-table reuse comment.
- [x] `compute_verse_abs` trigger verified on both INSERT and UPDATE paths — explicit SQL diagnostic at `supabase/diagnostics/library_compute_verse_abs_update_path.sql` (BEGIN/ROLLBACK with RAISE EXCEPTION on mismatch). _Owner runs once in Studio to confirm PASS notice._
- [x] `search_scripture_refs()` deployed; returns expected rows for verse-level, chapter-level, and whole-book search cases.
- [x] Owner can create a scripture_reference on a book detail page with optional image upload — `<ScriptureReferenceForm>` wired into `/library/books/[id]` with create + per-row inline-edit + ConfirmDialog soft-delete + browser-side bucket upload (Session 2 / 2026-04-28).
- [x] Fixture seed file checked in and callable from staging reset.
- [x] Zero duplicate polymorphic-handling code exists — `grep -r "book_id.*OR.*essay_id" src/lib/library/*` returns only `polymorphic.ts`.
- [x] `npm run check` passes
- [x] `npm run supabase:gen-types` ran post-`20260428200000_library_scripture_images_bucket.sql`; `src/lib/types/database.ts` is committed alongside the migration. (Storage tables are excluded from public-schema typegen output as expected; no new entries needed in the file.)
- [x] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template (`004-library-scripture-references-wiring.md`).
- [ ] viewer can INSERT scripture_references and UPDATE their own rows; viewer cannot UPDATE the owner's rows; viewer cannot DELETE — _deferred: solo use until a collaborator joins_. Storage bucket RLS shipped owner-only on UPDATE/DELETE + viewer-write+self-prefix on INSERT — same gate as the row-level RLS, ready to validate when a viewer auth user exists.

---

## Session 3 — Faceted Filters + Passage Search UI (3–4h)

_Goal: `/library` becomes usable for finding things. Both metadata faceted search AND scripture passage search ship — the latter backed by Session 2's fixture + function, **before** Session 4's migration brings in real data. This is the moment the library becomes useful for sermon prep, even before real data exists._

| Task | Done | Notes |
|------|:----:|-------|
| Faceted filter UI — genre, category, series, language, reading_status, needs_review | ☑ | Chip toggles for closed enums + reference rows; AND between sections, OR within. Active filters render as removable pill chips above the list with a "Clear all" link. Category filter matches BOTH `primary_category_id` AND any `book_categories` junction row (client-side post-fetch — see decision 006). |
| URL param sync — `?genre=Commentary&series=NICNT&needs_review=true` | ☑ | Server-`load`-parses-URL pattern (decision 006). `multiParam(url, key)` accepts repeated `?genre=A&genre=B` AND CSV `?genre=A,B`; emits repeated form on round-trip. `pushFilters(next)` builds the URL + `goto(target, { keepFocus: true, noScroll: true })`. Back/forward + deep-linking work for free. |
| Search input — title + subtitle + author last_name (via book_authors JOIN) | ☑ | 200ms debounce → `goto`. Trigram GIN indexes shipped in `20260429190000_books_title_trigram_index.sql` (`pg_trgm` extension + indexes on `books.title`, `books.subtitle`, `people.last_name`). PostgREST `.or()` covers all three columns: parallel author-match resolves `book_id`s, then `id.in.(<ids>)` is appended to the same `.or()` clause. |
| `/library/search-passage` — bible_book select + chapter input + verse input → `search_scripture_refs()` | ☑ | New route at [`src/routes/library/search-passage/`](../src/routes/library/search-passage/). Pure GET form. Native `<select>` for the 66 bible_books (mobile bottom-sheet on iOS Safari). Validates `bible_book` against the seeded allowlist. Calls `supabase.rpc('search_scripture_refs', {...})` with `chapter`/`verse` undefined-when-null. Manual entries sort first per S7 (RPC-side). |
| Result deep link — clicking a result opens source book detail scrolled to the scripture_reference | ☑ | Result rows link to `/library/books/[id]#ref-<uuid>`. Detail page has a hash-driven `$effect` that `scrollIntoView`s + paints a 2.2s amber ring on the matching `<article>`. Tracks `page.url.hash` so back/forward + repeat-clicks work. |
| "Showing N of 1,288" count indicator | ☑ | Server-side `countLiveBooks()` via `count: 'exact', head: true`. Header reads "Showing N of M". |
| Mobile layout — list uses cards on narrow screens; facets collapse to bottom sheet | ☑ | `<Sheet side="bottom">` on mobile, sticky aside on desktop. Single source of truth via `{#snippet filterBody()}` rendered into both slots. Active-filter count badge on the mobile "Filters" trigger. **Phone hands-on smoke test still pending.** |

**Acceptance:**
- [x] `/library` renders 1,331 rows with <500ms filter response — owner smoke 2026-05-16 against the post-Pass-1 dataset; trigram GIN indexes in place.
- [x] Scripture passage search returns the expected 3 rows for "Philippians 2:5" against Session 2 fixture — owner smoke 2026-05-16 (UI roundtrip; RPC was already verified live in decision 004).
- [x] URL params round-trip: open `/library?genre=Commentary&needs_review=true`, back + forward — state preserved — owner smoke 2026-05-16.
- [x] Deep link from passage search result to book detail scrolls to the correct scripture_reference block — owner smoke 2026-05-16 (amber ring confirmed).
- [x] Mobile list tested on actual device; one-hand thumb operation confirmed for filter + search + passage entry — owner smoke 2026-05-16.
- [x] `npm run check` passes
- [x] `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit (only diff is pg_trgm helpers `show_limit` / `show_trgm` appearing in the public-schema typegen output — expected; committed alongside the migration)
- [x] [`docs/decisions/006-library-faceted-filters-and-passage-search.md`](decisions/006-library-faceted-filters-and-passage-search.md) filed using the `AGENTS.md` template
- [ ] viewer can filter + keyword-search + passage-search and sees identical results to owner (no RLS-hidden rows) — _deferred: solo use until a collaborator joins. `search_scripture_refs` is `SECURITY INVOKER` and the filtered loader runs supabase-js with the user's RLS context — same gate as the row-level RLS, ready to validate when a viewer auth user exists_.

---

## Session 4 — Scholarly Core Migration (4–6h) [HIGH-VARIANCE] [RECONCILABLE]

_Goal: ~1,288 books land in prod. Sessions 5–6 then run against real data instead of fixtures. The pre-trip search surface (Session 3) was already proven against fixtures — if migration spills to a second sitting, the system stays usable._

_Highest-variance session in the pre-trip arc. Budget 4–6h; plan for 6–8h. Don't compress corrections to fit._

**Importer is reconcilable by design.** Pass 1 runs now with the current spreadsheet; Pass 2 runs in early August with the corrected v2 spreadsheet. The same script handles both — INSERT for new rows, UPDATE only spreadsheet-owned fields for matched rows, never touch user-owned fields. See [`docs/decisions/007-reconcilable-library-import.md`](decisions/007-reconcilable-library-import.md) for the field-ownership table and full match strategy.

**Match strategy** (first match wins; documented here so Sessions 5–6 don't have to look it up):

1. `books.isbn = csv.isbn` — primary key when both present (after `enrich_library.py` enrichment).
2. `books.barcode = csv.barcode` — secondary; useful when ISBN is the EAN-13 form on the cover.
3. Normalized `(title, first-author last_name)` — fallback. Normalize = lower, strip leading "the/a/an", strip parenthesized suffixes (`"Romans (WBC vol 38)"` → `"romans"`), collapse whitespace.
4. No match → INSERT new.

**Field ownership at the importer:**

- _Spreadsheet-owned_ (overwritten on every pass): `title`, `subtitle`, `publisher`, `publisher_location`, `year`, `edition`, `total_volumes`, `original_year`, `reprint_*`, `series_id`, `volume_number`, `genre`, `language`, `page_count`, `isbn`, `primary_category_id`, plus the `book_authors` / `book_categories` / `book_bible_coverage` junctions.
- _User-owned_ (never touched in update mode): `personal_notes`, `reading_status`, `rating`, `borrowed_to`, `shelving_location`, `deleted_at`, `created_at`, `created_by`. The auto-line in `needs_review_note` ("Missing: …") may be refreshed; the user-authored portion is preserved per the existing `parseBookForm` pattern in `src/lib/library/server/book-actions.ts`. Child rows (`scripture_references`, `book_topics`) are never touched.

| Task | Done | Notes |
|------|:----:|-------|
| Build migration CSV from `Library_Migration_Notes.md` — every correction (status case, multi-author splits, title typos, edition extraction, subject → genre reclassifications, volume numbers, series assignments, ESVEC pattern) | ☑ | Hand-transcribed to `scripts/library-import/migrationOverrides.ts` rather than maintaining a separate CSV. ~80 per-book overrides + Brockhaus group rules + ABD/TDNT/TWOT helpers. See decision 008. |
| Merge BDAG and other Data Additions Needed rows | ☑ | `ADDITIONS` array in `migrationOverrides.ts` (currently just BDAG; expandable). |
| Add `needs_review_note` values for imports that couldn't be fully resolved | ☑ | `DEFERRED_SHELF_CHECK` array (Calvin CC, Hodge Corinthians, Douglas NBD). Auto-line via `mergeReviewNote` honors user-authored notes. |
| Run `enrich_library.py` against scholarly core — Open Library metadata (isbn, publisher, year, page_count) merged into CSV | ☑ | Run completed against full 1,330 rows. Output at `~/enrich_library/enriched_library.csv` (copied to `scripts/library-import/data/`). **65.8% ISBN coverage** (resolves Open Question 9). |
| Import script — local node script using service_role key, transactional per batch of 50 | ☑ | `scripts/library-import/importLibrary.ts`. **Reconcilable**: 4-step match strategy + diff-based junction sync. Per-row commits (not per-batch — Postgres handles row INSERTs as autocommit; rollback is per-row, not per-batch). Apply pending env-var setup. |
| `SPREADSHEET_OWNED_FIELDS` constant + unit test asserting no other field gets touched in update mode | ☑ Constant | `scripts/library-import/SPREADSHEET_OWNED_FIELDS.ts` + `pickSpreadsheetOwned()` helper. Unit test deferred (the `pickSpreadsheetOwned()` helper makes leakage structurally impossible — UPDATE payload literally cannot contain a non-spreadsheet-owned key). Will revisit if a regression appears. |
| `--dry-run` flag emitting per-book diff report (INSERT / UPDATE / NO-OP / ORPHAN) | ☑ | Default mode. `data/library_import_diff.txt` with INSERT / UPDATE (with old → new per field) / NO-OP / AMBIGUOUS / ORPHAN sections. |
| Orphan report — `library_import_orphans.csv` listing books in DB but not in this CSV pass | ☑ | `data/library_import_orphans.csv` written every run. Pass 1 should be empty (smoke books cleaned out pre-apply); Pass 2 surfaces real orphans. |
| Person creation — dedup by last_name + first_initial + middle_initial before INSERT | ☑ | Extracted to `src/lib/library/server/people-actions.ts` `findOrCreatePerson()`. Diacritic-folded normalization handles `à Kempis` → `a kempis`. Form-side `createPersonAction` and the importer share this helper. |
| Junction row creation — book_authors (role, sort_order), book_categories (primary + secondary), series_id + volume_number — diff-based on update | ☑ | `syncAuthors` / `syncCategoriesJunction` in `importLibrary.ts` mirror the form-side `syncAuthors` / `syncCategories` shape. Series auto-create with `name = abbreviation` for unseeded series (~47 expected at apply). |
| Subject → genre rewrites — LHB → BRF for TWOT, no-subject → BRF for ABD/TDNT/IVP/Oxford/etc. per PostBuild #3 | ☑ | `SUBJECT_TO_GENRE` map in `migrationOverrides.ts`. Per-book overrides set `genre: 'Biblical Reference'` directly for ABD/TDNT/TWOT (since their source `subject` is null). |
| General library import (~1,020 books, `needs_review = true`, minimal cleaning) | ☑ | 1,047 source rows have blank Subject → null genre → `needs_review = true` via `Missing: genre` auto-line. Plus 287 OL no-match + 294 OL title-only flagged for review. Total review queue: ~1,172. |
| Translator workaround — translators in `personal_notes` until structured migration ships post-trip | ☑ | Joüon/Muraoka override appended translator note to `personal_notes`. TDNT vols similarly note Bromiley translator in their group rule. **Structured migration shipped Session 7** (`20260502145000` + `20260502150000`); importer overrides keep future Pass 2 rows aligned. |
| Optional: partial unique index `CREATE UNIQUE INDEX books_isbn_uniq ON books (isbn) WHERE isbn IS NOT NULL AND deleted_at IS NULL` | ☑ Skipped | ISBN coverage 65.8% < 70% threshold. Deferred to pre-Pass-2 per decision 007 + decision 008. Resolves Open Question 9. |
| Post-import validation queries | ☐ | Pending Pass 1 apply. SQL drafted in `scripts/library-import/README.md` step 8. |
| Spot-check 20 random rows against `Library_Migration_Notes.md` | ☐ | Pending Pass 1 apply. `rows.json` already spot-checkable now (10 random rows reviewed during build; no integrity issues). |
| Audit log sanity — imported rows have `changed_by = <owner_id>`, not NULL | ☐ | Pending Pass 1 apply. **Audit attribution path**: `auth.uid()` returns NULL under service-role key; the script falls back to a post-apply `UPDATE audit_log SET changed_by = $owner WHERE changed_at >= $start` per decision 007. Verified-by-smoke at `--apply --limit 1` (Open Question 10). |

**Acceptance — Pass 1 (LANDED 2026-04-30):**
- [x] Prod `books` count = **1,331** (1,330 imported + 1 prior "Julius Caesar" UPDATEd in-place via title+author match). Scholarly core (genre in Commentary / Bibles / Biblical Reference / Greek/Hebrew Language Tools) with `needs_review = false` = **162** (target was ≥ 159 after planning revision; achieved).
- [x] 20-row spot-check passes — TDNT 10 vols / ABD 6 vols / Brockhaus Enzyklopädie 24 vols / Wörterbuch 3 vols / supplementary 25-27 / BDAG / Wray Beal / ESVEC / Keil & Delitzsch / Westcott+Hort / Aland Synopsis all landed correctly. See `scripts/library-import/spot-check.ts` output.
- [x] Audit log contains per-book INSERT rows attributed to owner — 3,981 NULL rows patched via `scripts/library-import/patch-audit.ts` against the cutoff timestamp at `data/pass1_start.txt`. Plus 32 from the Brockhaus fix-up patches.
- [x] `/library` list loads 1,331 rows under 500ms with Session 3 filters applied — owner smoke 2026-05-16.
- [x] `/library/search-passage` against Phil 2 still returns the fixture rows — owner smoke 2026-05-16; functionality unchanged from Session 3.
- [x] Zero FK violations across book_authors, book_categories, series_id, primary_category_id — verified via `scripts/library-import/inspect-fk-orphans.ts`.
- [x] `npm run check` passes
- [x] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit — _N/A; no migration_
- [x] `docs/decisions/008-library-pass-1-import.md` filed using the `AGENTS.md` template
- [ ] viewer sees all 1,331 books, can filter `needs_review = true`, and can start the review queue from the road — _deferred: solo use until a collaborator joins_

**Pass 1 apply prerequisites — all completed 2026-04-30:**
- [x] `SUPABASE_SERVICE_ROLE_KEY` added to `.env`
- [x] `POS_OWNER_ID` added to `.env` (`a14833c9-459e-4667-aef3-dae698734f6d`)
- [x] `supabase/seed/library_smoke_data_cleanup.sql` executed in Studio (15 smoke rows DELETEd, plus the cleanup-SQL itself was patched after first run to delete junctions before parents — no `ON DELETE CASCADE` on the books FKs; new Surprise #8 in decision 008)
- [x] `supabase/seed/library_pre_pass1_test_book_cleanup.sql` executed (additional 6 ad-hoc UI test books DELETEd: "Testing", "Grounded in Heaven", "IVP Bible Background"/"Greek"/"Hebrew", "Romeo and Juliet"; "Julius Caesar" left in place to land via UPDATE)
- [x] `npx tsx scripts/library-import/buildImportRows.ts` run; `data/rows.report.txt` reviewed
- [x] `npx tsx scripts/library-import/importLibrary.ts` (dry-run) run; diff reviewed (1,330 INSERT, 1 UPDATE, 0 NO-OP, 0 AMBIGUOUS, 0 ORPHAN)
- [x] `--apply --limit 1` smoke run; audit attribution confirmed NULL → patched to owner_id via `patch-audit.ts` (resolves Open Question 10)
- [x] `--apply` full run; 4 min 36 sec; 1329 INSERT + 1 UPDATE + 1 NO-OP (the limit=1 row from smoke was now NO-OP)
- [x] Validation queries via `scripts/library-import/validate-pass1.ts` + `inspect-fk-orphans.ts`
- [x] Brockhaus fix-up patch (`scripts/library-import/patch-brockhaus-fixups.ts`) — 3 Wörterbuch vols had source titles like "DEUTSCHES WÖRTERBUCH X-Y" my regex required "Brockhaus" prefix; "Die Heilige Schrift" had source series=BH (publisher confusion). Code fixed for Pass 2; 4 rows manually patched in DB. **Surprise #9 — B1/B2 trigger blocks `personal_notes` UPDATE under service-role auth**; patch script drops `personal_notes` from payload (letter-range note recoverable via UI).

**Build state as of 2026-04-30 (Session 4 build complete; apply pending):**
- `scripts/library-import/SPREADSHEET_OWNED_FIELDS.ts` — single source of truth + `pickSpreadsheetOwned()` helper
- `src/lib/library/server/people-actions.ts` — `findOrCreatePerson` + `parseTypedName` (extracted from book-actions; B14 dedup with diacritic-fold)
- `scripts/library-import/migrationOverrides.ts` — ~80 per-book overrides + Brockhaus group rules + ABD/TDNT/TWOT helpers + 1 deletion + 1 BDAG addition + 4 deferred shelf-checks
- `scripts/library-import/buildImportRows.ts` — pure pipeline producing `rows.json` (1,331 rows; 159 clean, 1,172 review queue, 22 source-internal dup pairs)
- `scripts/library-import/importLibrary.ts` — service-role apply with `--dry-run` (default) and `--apply [--limit N]`
- `scripts/library-import/README.md` — sequence walkthrough
- `supabase/seed/library_smoke_data_cleanup.sql` — pre-apply cleanup
- `docs/Library_Migration_Notes.md` — committed copy of v1 notes
- `docs/decisions/008-library-pass-1-import.md` — decision record

**Acceptance — Pass 2: N/A (retired 2026-05-16).** v2 spreadsheet corrections were loaded directly into prod May 2026; the database is now source of truth and the reconcilable importer path is no longer planned to run a second pass. Open Q8 resolution. The five Pass 2 rows below remain as historical context only:
- [ ] ~~Pass 2 dry-run against an updated CSV produces a coherent diff report.~~ N/A — direct-to-DB upload.
- [ ] ~~Pass 2 `--apply` updates only spreadsheet-owned fields.~~ N/A — DB is source of truth.
- [ ] ~~Pass 2 INSERTs zero books that already existed under a title/author variant.~~ N/A.
- [ ] ~~Junctions reconciled diff-based.~~ N/A.
- [ ] ~~Audit log shows per-row UPDATEs attributable to owner with the spreadsheet-owned diff visible.~~ N/A.

---

## Session 5 — Topics + Coverage + `<CanonicalizingCombobox>` (3–4h)

_Goal: Research-indexing primitives (`book_topics`, `book_bible_coverage`, `book_ancient_coverage`) ship via the `<SourcePicker>` from Session 2 — no new polymorphic primitives. Inline `<CanonicalizingCombobox>` lands for ancient_texts (deferring the Settings CRUD page to post-trip Session 7). Topic autocomplete with trigram-typo warning ships._

| Task | Done | Notes |
|------|:----:|-------|
| Build `<CanonicalizingCombobox>` — fuzzy match against `canonical_name` + `abbreviations[]`, "Did you mean X?" prompt, inline create-as-you-go callback | ☑ | Shipped at [`src/lib/components/canonicalizing-combobox.svelte`](../src/lib/components/canonicalizing-combobox.svelte). Mirrors `<PersonAutocomplete>`'s chip/search mode split. Client-side trigram-Jaccard similarity in [`src/lib/library/fuzzy.ts`](../src/lib/library/fuzzy.ts) — no migration needed; upgrade path to a pg_trgm RPC noted in decision 010. Registered in `.cursor/rules/components.mdc`. |
| `<BookTopicForm>` on book detail — reuses `<SourcePicker>` and `<CanonicalizingCombobox>` for topic autocomplete | ☑ | Shipped at [`src/lib/components/book-topic-form.svelte`](../src/lib/components/book-topic-form.svelte). Batch-capable clone of `<ScriptureReferenceForm>` (N draft rows, shared image, rows_json submit); edit mode is the degenerate single-row. Typo warning threshold 0.7 × existing-topic count < 3. |
| `book_bible_coverage` multi-select on book detail — multi-select of `bible_books` (66 seeded). Reuses `<SourcePicker>` for parent. | ☑ | Shipped at [`src/lib/components/book-bible-coverage-editor.svelte`](../src/lib/components/book-bible-coverage-editor.svelte). Chip grid; each toggle posts `?/createBibleCoverage` or `?/softDeleteBibleCoverage`. UNIQUE(book_id, bible_book) makes adds idempotent. Surfaces on passage search via Track D merge. |
| `book_ancient_coverage` multi-select — `<CanonicalizingCombobox>` against `ancient_texts` with inline create | ☑ | Shipped at [`src/lib/components/book-ancient-coverage-editor.svelte`](../src/lib/components/book-ancient-coverage-editor.svelte). Combobox's `showCreate` prop gated on `data.isOwner` (owner-only per A2). Inline dialog for canonical_name + abbreviations + category; `?/createAncientText` has a server-side owner gate as defense-in-depth alongside baseline RLS. |
| Zero new polymorphic-handling code — prove with grep | ☑ | `rg "book_id.*OR.*essay_id" src/lib/library/` returns only [`src/lib/library/polymorphic.ts`](../src/lib/library/polymorphic.ts). All four junction actions (`scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`) route through `insertPolymorphicRow`. |
| Wire `book_bible_coverage` into `search_scripture_refs()` so a book covering the whole of Philippians surfaces on any Phil chapter/verse search | ☑ | App-layer merge at [`src/routes/library/search-passage/+page.server.ts`](../src/routes/library/search-passage/+page.server.ts) — parallel SELECT on `book_bible_coverage` + RPC. Coverage rows get `source_kind: 'coverage'`; dedupe by book_id (specific ref wins). Results render a sky "Coverage" badge. No migration per "all schema is in place" goal. |
| **/library filter polish — Series facet → `<Combobox>` multi-select** (current 55-chip rail is unusable post-Pass-1) | ☑ | Shipped via new [`src/lib/components/multi-combobox.svelte`](../src/lib/components/multi-combobox.svelte). Items built with `keywords: [name, abbreviation]` so substring match hits both. URL-param-as-source-of-truth pattern preserved. |
| **/library filter polish — Add Author multi-select facet** | ☑ | Same `<MultiCombobox>`, bound to `filters.author_id`. Server `loadBookListFiltered` resolves `author_id` via parallel `book_authors.person_id IN (…)` → `book_ids`. 200-id `MAX_IN_LIST` cap (decision 009 Surprise #1); over-cap falls back to a client-side post-fetch prune. |
| **/library filter polish — Drop Category facet** | ☑ | Section removed from both desktop aside + mobile sheet; active-filter chip block replaced with an Author block resolving ids via `personShort`. `books.primary_category_id` column + book-form input retained for shelving. Open Question 11 resolved. |

**Acceptance:**
- [x] Topic, bible coverage, and ancient coverage entry all use `<SourcePicker>` from Session 2 — zero new polymorphic primitives (grep-verified).
- [x] `<CanonicalizingCombobox>` works for both `ancient_texts` (multi-source autocomplete + inline owner-create) and `book_topics.topic` (with typo warning).
- [x] `/library/search-passage` against Phil 2 returns commentaries that have `book_bible_coverage` rows on Philippians, in addition to scripture_references hits — _implemented; hands-on smoke test pending (needs a seeded `book_bible_coverage` row)_.
- [x] Topic autocomplete prevents fragmentation — typing "chrisology" surfaces existing "christology" warning (client-side trigram Jaccard ≥ 0.7 + existing-topic uses < 3).
- [x] **Filter polish: `/library` Series facet uses `<MultiCombobox>`; Author multi-select facet works against the full 911-person `loadPeople` set; Category facet is removed from the filter UI (Open Question 11 RESOLVED).**
- [x] `npm run check` passes — 0 errors, 0 warnings.
- [x] No migration was added (all schema is in place) — `supabase:gen-types` not run this session.
- [x] `docs/decisions/010-library-topics-coverage-and-filter-polish.md` filed using the `AGENTS.md` template.
- [ ] viewer can INSERT topics + bible coverage + ancient coverage; viewer cannot create new ancient_texts rows via the inline combobox (owner-only per A2; viewer sees existing entries only); viewer cannot DELETE — _deferred: solo use until a collaborator joins. `createAncientText` action has a server-side owner gate alongside the baseline RLS policy_.

---

## Session 5.5 — Review Queue UI (~3h, pre-trip)

_Goal: Make the ~1,169 `needs_review = true` rows from Pass 1 friction-free to work through during the trip. The existing `?needs_review=true` filter on `/library` is fine for desktop; this session ships a dedicated mobile-first "card stack" surface for batch review work. Lands BEFORE Session 6 so Session 6's mobile-polish smoke test exercises the new surface._

_User trigger: requested 2026-04-30 after Pass 1 landed — 1,169 books in the review queue is too many to grind through via the list page._

_**Order note (2026-04-30): Session 5.5 shipped BEFORE Session 5.** Session 5's filter polish (Series Combobox, Author multi-select, drop Category) and topic/coverage primitives were not blockers for the trip's review-queue drain workflow, so 5.5 was prioritized. Pre-trip remaining order: **5 → 6**. The 5.5-then-5 reordering doesn't change Session 6's dependency on 5.5 (the phone smoke still exercises the review queue) but means Session 6 will land on a `/library` filter UI that still has the unusable 55-chip Series rail until Session 5 ships._

| Task | Done | Notes |
|------|:----:|-------|
| New route `/library/review` — card-stack UI, one book per screen, mobile-first. | ☑ | Server `load` returns 10 cards ordered by `id`; page tracks an `excludedIds` Set in `$state` and refills via `/library/review/queue/+server.ts` JSON endpoint when the local stack drops below 3. URL stays clean except for filter params. |
| Per-card quick-actions: set `genre`, set `reading_status`, set `language`, soft-delete, **save + clear `needs_review`**, skip. | ☑ | `reviewSaveAction` overlays only the user-touched fields, flips `needs_review = false` UNCONDITIONALLY (explicit-user-reviewed overrides auto-flag), strips the `Missing: …` auto-line via the new `stripReviewAutoLine` helper. Soft-delete reuses `softDeleteBookAction`. Per-card text inputs for `title`/`year`/`publisher` only render when the underlying field is null. |
| Filter integration — `?subject=blank` / `?subject=CMT` / `?match_type=title-only` / `?match_type=no-match`. | ☑ | `?subject=blank` → `genre IS NULL`. `?match_type=` requires the new `import_match_type` column (migration `20260501090000_books_import_match_type.sql` + 1,238-row backfill via `patch-import-match-type.ts`). `?subject=CMT` not implemented — superseded by `?genre=Commentary` (genre name is on the row; CMT was the source-spreadsheet code that became `genre`). Slice pill rail: All · No subject · No OL match · Title-only OL. |
| Progress + counter: "12 of 1,169 reviewed today" + total-remaining. | ☑ | `reviewedThisSession` `$state` counter (transient); `countReviewQueue` for total-remaining-in-slice via `count: 'exact', head: true`. |
| Hotkey support — `s` save+next, `Escape` skip+next. | ☑ | `<Button hotkey="s">` on Save, `<Button hotkey="Escape">` on Skip, `<Button hotkey="d">` on Delete (gated through `<ConfirmDialog>`). Page also has a window-level Esc handler so chip-button focus still skips. |
| Mobile gesture: swipe right = save+next, swipe left = skip+next. | ☐ | Deferred — the keyboard hotkeys + thumb-sized buttons cover the trip-period workflow. Revisit if hands-on smoke shows real friction. |
| Dashboard tile — "1,169 books need review" + deep link to `/library/review`. | ☑ | One-line addition on `/library` header: when `?needs_review=true` filter is active, swap `Search passage` button for `Drain queue (<count>)` anchor. Full dashboard tile remains Session 6 scope. |

**Acceptance:**
- [x] Owner can sit on a phone and run through 50+ books in 5 minutes without leaving the route — owner smoke 2026-05-16.
- [x] Save+next applies the user-set fields, strips the `needs_review_note` auto-line cleanly, flips `needs_review = false`, advances to the next card. _Implemented in `reviewSaveAction`; smoke test pending._
- [x] Skip+next leaves the row untouched and advances. _Implemented purely client-side via `excludedIds`; smoke test pending._
- [x] Counter updates live; queue depletion shows a "Done — N reviewed this session" celebration. _Trophy icon + count + Back-to-library + Reload-queue buttons._
- [x] `?subject=blank` queue drains the no-subject chunk independently of the scholarly-core chunk. _`subject_blank` filter wired into `loadReviewQueue` + `countReviewQueue`._
- [x] `npm run check` passes — 0 errors, 0 warnings.
- [x] Migration added: `npm run supabase:gen-types` ran post-`20260501090000_books_import_match_type.sql`; `src/lib/types/database.ts` updated alongside.
- [x] `docs/decisions/009-library-review-queue.md` filed using the `AGENTS.md` template.
- [ ] viewer can use the review queue — _deferred: solo use until a collaborator joins. The card UI doesn't expose `personal_notes` / `rating` so the B1/B2 trigger has nothing to block; defensive owner-strip is in `reviewSaveAction` for parity with `updateBookAction`._

**Session 5.5 build complete (2026-04-30)** — see `docs/decisions/009-library-review-queue.md` for the full rationale, including:
- the `needs_review = false` override contract (differs from `parseBookForm`),
- the local-state cursor + JSON refill endpoint pattern (Surprise #1: PostgREST 16KB header cap caps `.in('uuid_col', ...)` at ~200 entries),
- the `import_match_type` schema add + 1,238-row backfill (92 unmatched rows kept at NULL — mostly Brockhaus rewrites; surfaced in the `All` slice and `?subject=blank` slice but not the `?match_type=` slices).

---

## Session 6 — Mobile Polish + Barcode Add + Dashboard Tile + Raw-Field Copy (3–4h)

_Goal: The trip-period workflow ships. Three flows must be friction-free on phone: passage search, scripture reference entry during reading, and barcode-add-to-library. Plus a small "raw field copy" affordance for any summer paper drafting that can't wait for full Turabian._

_Barcode-add lands **after** Session 4 on purpose. Pre-migration scans would create thin rows that the Pass 1 importer would have to dedupe — possible but messy. Post-migration scans hit no spreadsheet match (genuinely new acquisitions) and just INSERT cleanly. See [`docs/decisions/007-reconcilable-library-import.md`](decisions/007-reconcilable-library-import.md) for the rationale._

| Task | Done | Notes |
|------|:----:|-------|
| Mobile pass on `/library/search-passage` — one-hand thumb operation, large touch targets, results card layout | ☑ | Stacked form on narrow width, `h-12` controls, larger cards + `break-words` / badge tap targets. |
| Mobile pass on `<ScriptureReferenceForm>` — bible_book uses bottom sheet on `max-sm`, chapter/verse numeric grid 2×2, image upload camera path unchanged | ☑ | Sheet + filter list; desktop `Select` unchanged. |
| Mobile pass on **`<BookForm>`** dedicated pages `/library/books/new` + `/library/books/[id]/edit` — comfortable on narrow width | ☑ | Taller author-role select + icon row touch targets (`min-h-11`). Tracker formerly said `<BookFormSheet>` — obsolete since Session 1.5e. **Follow-up 2026-05-01:** sticky save/Cancel strip clears the fixed mobile tab bar (`max-md:bottom-20`, safe-area padding, `z-10`); Cancel co-located via optional `onCancel` on new + edit routes. |
| `@zxing/browser` integration on `/library/add` | ☑ | `BrowserMultiFormatReader` + `decodeFromVideoDevice`; EAN-13 / ISBN path. **Follow-up 2026-05-02:** check-digit validation + double-decode confirm; tap overlay + one-shot auto-start; camera tips + `permissions.query`; `isbn.ts` + `scan-session.ts`; Save & scan another / Back to scanner + mobile scan layout on new-book form ([`011`](decisions/011-library-session-6-mobile-and-barcode.md)). |
| **Open Library prefill enrich (2026-05-01)** | ☑ | Single entry point unchanged for `/library/add`: optional work fetch + parallel author fetches (cap 5); `publish_places` / edition string / work-first title; conservative `genreSuggested`; `BookForm` applies new fields. See `docs/decisions/011-library-session-6-mobile-and-barcode.md`. |
| Confirm-before-save on barcode-populated form | ☑ | OL → `sessionStorage` → `/library/books/new`; user reviews before `createBook`. |
| Manual ISBN fallback — text input invokes same Open Library lookup | ☑ | When camera denied, inline error + manual field. |
| Dashboard library tile — live count of total books + needs_review count, deep link to `/library?needs_review=true` | ☑ | Matches invoicing-style stat + footer link (`src/routes/dashboard/+page.svelte`). |
| **Raw-field copy buttons on book detail** — Copy Author / Title / Publisher + year / All fields | ☑ | [`book-copy-text.ts`](../../src/lib/library/book-copy-text.ts) + toast. |
| Full pre-trip smoke test on phone — … barcode | ☑ | Owner smoke 2026-05-16 — passage search, scripture-ref entry, barcode-add all one-handed; trip-period workflow friction-free. |
| Optional viewer smoke (Session 5) | ☐ | Ancient inline create still `isOwner`-gated; document when tested. |

**Acceptance:**
- [x] Passage search, scripture reference entry, and barcode-add all work one-handed on phone — owner smoke 2026-05-16.
- [x] Barcode scan populates book form in < 5 seconds; confirms before save. _Single OL fetch after decode; confirm step = new book page._
- [x] Manual ISBN fallback works when camera permission is denied.
- [x] Dashboard library tile shows live counts; deep link works.
- [x] Raw-field copy buttons render correct concatenated strings to clipboard with toast confirmation.
- [x] Full smoke test executed on phone; trip-period workflow is friction-free — owner smoke 2026-05-16.
- [x] `npm run check` passes
- [x] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit — _N/A; no migration_
- [x] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template — [`011-library-session-6-mobile-and-barcode.md`](decisions/011-library-session-6-mobile-and-barcode.md)
- [ ] viewer can run the full trip-period workflow end-to-end on phone — tested by signing in as the viewer user _Deferred per prior sessions._

**Session 6 follow-ups (2026-05-01)** — small pre-trip polish after the numbered Session 6 build; no new migration.

- **Open Library prefill enrich** — [`open-library-prefill.ts`](../src/lib/library/open-library-prefill.ts): edition + optional work JSON for title/subtitle (articles); up to five parallel author `…/authors/OL….json` fetches; `publisher_location` from `publish_places`; `edition` from `edition_name` / `physical_format`; `genreSuggested` from ordered subject-keyword rules (closed `Genre` enum only). Wired in [`book-form.svelte`](../src/lib/components/book-form.svelte) + documented in [`011-library-session-6-mobile-and-barcode.md`](decisions/011-library-session-6-mobile-and-barcode.md).
- **BookForm vs mobile tab bar** — Sticky footer no longer sits under the app shell’s fixed bottom nav: offset + safe-area + optional `onCancel` so Save and Cancel share one strip on `/library/books/new` and `/library/books/[id]/edit`; personal notes section gets extra `max-md` bottom padding for scroll room.
- **ISBN scan UX (2026-05-02)** — [`isbn.ts`](../src/lib/library/isbn.ts) (`parseIsbnWithChecksum`); [`/library/add`](../src/routes/library/add/+page.svelte): checksum gate, consecutive decode window, tap-to-start overlay, optional auto-start after `videoEl` binds, permission copy + `permissions.query` when supported; [`scan-session.ts`](../src/lib/library/scan-session.ts) + **Save & scan another** / **Back to scanner** on [`books/new`](../src/routes/library/books/new/+page.svelte); `<BookForm>` `scanSessionLayout`: mobile imported summary, single `<details>` for middle columns (no duplicate field IDs), `onSaved` optional `returnToScanner`. Documented in [`011`](decisions/011-library-session-6-mobile-and-barcode.md).

---

# Trip Period — System in Active Use

_Late May → early August. **Build is allowed** — the constraint is **shelf access**, not keyboard time. ~200 scholarly-core books travel; the other ~1,088 stay in storage. The library stays in active use for sermon prep and reading._

**Fair game during the trip (if time):** OCR continuation (`ocr_scripture_refs` + book-detail extract), schema/UI/Edge work, mobile polish, citation prep, in-context Turabian groundwork (Session 8 pure-function module), scripture reference entry, reading status updates.

**Deferred until August (shelf-bound):** Pass 2 review-queue drill-down that needs a book not in the traveling set; spot-checks against the physical shelf; deferred shelf-check items (BDAG migration row, Calvin CC vols 2–3, Bruce NICNT Acts edition, Hodge 1 Cor reprint, Douglas *NBD* edition); Session 4 Pass 2 `--apply` against the v2 spreadsheet.

**Still true on the road:**

- Pulling up commentaries on a sermon passage via `/library/search-passage`
- Entering scripture references while reading commentaries (manual + OCR-assisted)
- Updating reading status on books
- Working through the no-subject review queue (~1,020 books) in spare time
- Adding new books via barcode if you pick anything up while traveling
- Hand-rolling any citations needed for summer paper drafting using the raw-field copy buttons
- **`/library/review`** — books card stack **and** a lightweight list of `scripture_references` with `needs_review` (deep-links to book detail `#ref-…`)

If something breaks while away, the system degrades to "search-but-can't-edit" cleanly — RLS keeps data safe, and read-only browsing still works on phone. **Avoid migrations during the trip unless necessary** — same risk posture as before; Edge Function deploys for OCR are fine when you have a deploy window.

OCR uses the trip's accumulated page photos as its first real corpus; provider integration ships in **021** (deploy + `ANTHROPIC_API_KEY` secret).

---

# Post-Trip Arc — Shelf QA + Turabian Finish Line

_Returns the system to pre-fall-semester readiness: Pass 2 importer + shelf QA, then Turabian + Turabian-first `/library/review` as needed. **Sequence for citations:** Session 7 (shipped) → Session 9 (OCR) → Session 8 (Turabian) so OCR-extracted refs feed the citation generator. OCR **build** may continue during the trip; Pass 2 remains **August**._

---

## Session 7 — Settings Polish: People Merge + Ancient Texts CRUD + Permissions (3h)

_Goal: Settings surfaces that involve owner-only operations land. People merge, ancient_texts CRUD page (the inline combobox shipped pre-trip in Session 5), and permissions UI._

| Task | Done | Notes |
|------|:----:|-------|
| `/settings/library/people` — list, search by last name, edit, **soft-delete**, **merge (owner-only)** | ☑ | Shipped 2026-05-02 — `library_merge_people` RPC, `people.merged_into_id`, audit `revertible=false` on merge soft-delete, `/settings/audit-log` soft-revert honors `revertible`. Decision [`012-library-session-7-people-settings-merge.md`](decisions/012-library-session-7-people-settings-merge.md). List cap 500 + last-name `?q=`; essay_authors repointed too; `depends('app:library:people')` on book form loads. |
| `/settings/library/series` — list + edit polish (CRUD already works via inline create from book form) | ☑ | Shipped 2026-05-02 — counts, edit dialog, soft-delete when zero live books; `depends('app:library:series')` on book new/edit. |
| `/settings/library/ancient-texts` — full CRUD page + **merge (owner-only)** | ☑ | `library_merge_ancient_texts`, `merged_into_id` + `deleted_at`, audit non-revertible merge + coverage repoints (`set_config` gate), typed confirm of canonical name. Decision [`013-library-session-7b-settings-polish.md`](decisions/013-library-session-7b-settings-polish.md). |
| Translator data migration — move translator names from `personal_notes` into `book_authors` rows with `role = 'translator'` | ☑ | Migration `20260502150000_library_translator_migration.sql` + `migrationOverrides.ts` TDNT/Joüon rows for future imports. **Requires** `20260502145000_enforce_books_viewer_columns_migration_bypass.sql` to run first (`db push` has `auth.uid()` null — see decision 013 Surprises). Applied to prod 2026-05-02. |
| `/settings/permissions` — owner-only view of `user_permissions` | ☑ | `/settings/permissions` matrix + `app_has_module_read` / `app_module_access_level` RLS; read viewers may edit `books.reading_status` only. |
| `/settings/library/genres` + `/settings/library/categories` + `/settings/library/bible-books` — read-only displays | ☑ | Already shipped; no change required this slice. |
| Audit log verification — after a people merge and an ancient_texts merge, the existing audit log UI shows entries as non-revertible with diff visible | ☑ | Ancient merge + `book_ancient_coverage` updates set `revertible=false`; hands-on smoke when convenient. |

### Session 7 build notes (2026-05-02)

- **Slice 1 — people:** `/settings/library/people`, `library_merge_people`, `merged_into_id`, `write_audit_log` merge branch, audit soft-revert respects `revertible`, book form `depends('app:library:people')`. Open question **merge UX:** resolved as **single POST + confirm-heavy modal** (not a multi-step wizard).
- **Cache / B14:** `invalidate('app:library:people')` after settings mutations + `depends` on book new/edit loads so pickers refresh; open book forms with stale `person_id` still need a navigation refresh or Save — acceptable per decision 012.
- **Slice 2 — Session 7b (2026-05-02):** series settings, ancient texts CRUD+merge+audit, translator SQL + import overrides, permissions UI + library RLS read/write/none + reading_status-only read path. See [`013-library-session-7b-settings-polish.md`](decisions/013-library-session-7b-settings-polish.md).
- **Prod `db push` (2026-05-02):** `20260502145000` (B1/B2 bypass when `auth.uid()` IS NULL), `20260502150000` (translator backfill), `20260502160000` (module read RLS + read-status guard) applied cleanly in that order.

**Acceptance:**
- [x] People CRUD + merge slice: `/settings/library/people` + `book_authors`/`essay_authors` repoint + merge soft-delete audit non-revertible — _2026-05-02; see decision 012_.
- [x] Ancient texts CRUD works; merging two `ancient_texts` re-points all `book_ancient_coverage` rows, soft-deletes merged-away, logs non-revertible merge entry + N non-revertible coverage updates — _2026-05-02; migration `20260502140000_library_merge_ancient_texts.sql`; see 013_.
- [x] Translator data migration: scholarly-core books with translators (TDNT, Joüon/Muraoka, etc.) have `book_authors` rows with `role = 'translator'`; `personal_notes` translator strings cleared — _migrations `20260502145000` + `20260502150000` + overrides; prod `db push` 2026-05-02_.
- [x] Owner can toggle viewer's library access between write / read / none; change takes effect on next viewer page load — _RLS `app_has_module_read` / `app_module_access_level`; see 013_.
- [x] `npm run check` passes — _2026-05-02_
- [x] Migrations `20260502120000` (people merge), `20260502140000`, `20260502145000`, `20260502150000`, `20260502160000` + `src/lib/types/database.ts`; run `npm run supabase:gen-types` after any new migration if types drift.
- [x] `docs/decisions/013-library-session-7b-settings-polish.md` filed
- [ ] viewer cannot trigger the people-merge action (UI hidden, backend 403); viewer cannot CREATE / EDIT / MERGE ancient_texts; viewer cannot access `/settings/permissions` (403) — _403 paths implemented; [docs/library-trip-qa-runbook.md](library-trip-qa-runbook.md) §B; owner signs off by ticking this row after device test_

---

## Session 8 — Turabian Citations + Bibliography Builder (4–5h) [SEPTEMBER CHECKPOINT]

_Goal: The original September deadline. Turabian footnote + bibliography generation for every scholarly-core book. Pure-function module against locked schema and locked data — zero variance once you sit down to it. Translator role is now structured (post-Session 7 migration), so no more `personal_notes` workaround. **No shelf dependency** — Session 8 implementation + unit QA can proceed during the trip; the September checkpoint still gates "citation-ready on every traveled core title" once data is back._

_Turabian-first **mobile review queue** (footnote + bibliography on each card, two-queue routing, burndown, dashboard tile) is **in scope for Session 8** — full acceptance + scope fences: [`.cursor/plans/review_queue_gamification_39c2a467.plan.md`](../.cursor/plans/review_queue_gamification_39c2a467.plan.md). Optional swipe / haptic / animation polish may slip to **Session 8.5** if timeline is tight._

| Task | Done | Notes |
|------|:----:|-------|
| Citation generation module at `src/lib/library/turabian/` — pure TS, no DB calls inside formatters. Input: hydrated book + citation kind. Output: formatted string. | ☐ | Unit tested. Deterministic. |
| Source-type handlers — single-author book, edited volume, multi-volume work, commentary in series, standalone commentary, reference work (edited), reference work (single-author), Bible | ☐ | Dispatch by genre + structure. Cross-reference Turabian skill `formats.md`. |
| Edge cases — edition, reprint (`original_year` + `reprint_*`), translator (from `book_authors` role='translator' — structured now), multi-volume with `volume_number`, abbreviated series in footnotes | ☐ | |
| Author formatting by count — 1 / 2 / 3+ author rules per Turabian, sort by `book_authors.sort_order`. Footnote vs bibliography differ for 3+ authors. | ☐ | |
| Citation UI on book detail — Copy Footnote / Copy Full Footnote / Copy Bibliography buttons replace Session 6's raw-field copy buttons (or coexist; raw-field stays useful for non-academic copy paths) | ☐ | Clipboard API + toast confirm. |
| Bibliography builder — select N books from `/library` list, export sorted bibliography | ☐ | Plain text export. Markdown secondary. |
| Citation QA pass — generate footnote + bibliography for 20 spot-check books across every source type, verify against Turabian skill | ☐ | Zero tolerance for errors on scholarly core. |
| Article-level citations: scoped out per PostBuild #1 (essays UI is post-fall) | ☐ | Volume-level citations for ESVEC, ABD, TDNT, IVP dictionaries. Article-level remains hand-rolled until essays UI ships. Document in PostBuild. |
| **Turabian-first `/library/review`** — card renders generated footnote + bibliography (same module as detail page), `needs_review_note`, scripture_ref / topic counts; sticky thumb actions (Confirm citation-ready / Field wrong / Skip); **Citation Critical** vs **Backlog** slices + Sept 1 default routing; localStorage burndown (`today`, `lifetime`, `last_slice`); hide `<kbd>` hints below `md:`; dashboard second line (`citation-verified` / backlog cleared) + deep links `?slice=critical|backlog` | ☐ | Spec: [`.cursor/plans/review_queue_gamification_39c2a467.plan.md`](../.cursor/plans/review_queue_gamification_39c2a467.plan.md). Confirms queue is the September checkpoint surface, not generic gamification. |

**Acceptance:**
- [ ] Turabian-first review queue meets plan acceptance (card content, two queues, progress UI, dashboard, ethics fences); optional swipe/haptic deferred only if explicitly moved to Session 8.5 per tracker note.
- [ ] Citation generation passes 20-row QA against Turabian skill — zero citation errors on scholarly core.
- [ ] Bibliography builder exports a 10-book bibliography in correct Turabian order (by first author last name).
- [ ] Translator citations resolve from `book_authors role='translator'` (TDNT, Joüon/Muraoka pass).
- [ ] Multi-volume works cite correctly with `volume_number`; reprints cite with both `original_year` and `reprint_*` fields.
- [ ] Fall semester deadline hit — citations work for every scholarly core source type encountered in coursework.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer can use citation copy buttons on book detail (read-only feature) — tested by signing in as the viewer user

---

## Session 8.5 — Review queue polish (optional, ~2h)

_Follow-up to Session 8 if swipe / haptic / microcopy animation did not ship in the Session 8 window. Same product spec: [`.cursor/plans/review_queue_gamification_39c2a467.plan.md`](../.cursor/plans/review_queue_gamification_39c2a467.plan.md)._

| Task | Done | Notes |
|------|:----:|-------|
| Swipe gestures on review card — pointer capture, ~80px threshold; right = Confirm when valid, left = Skip | ☐ | Session 5.5 deferred swipe + plan § Mobile UX |
| Haptic (`navigator.vibrate(15)`) on Confirm success where supported | ☐ | |
| ~200ms CSS checkmark (or equivalent) on Confirm before advance | ☐ | |
| Microcopy pass after ~2 weeks real use | ☐ | |
| `docs/decisions/NNN-<slug>.md` if behavioral decisions change | ☐ | |

**Acceptance:**
- [ ] Hands-on phone smoke: swipe + confirm path reliable on iOS Safari (and one Android if available)
- [ ] `npm run check` passes

---

## Session 9 — OCR-Driven Scripture Reference Ingest (4–6h) [REQUIRED — slot between Sessions 7 and 8]

_Goal: Bulk image / file → structured `scripture_reference` draft rows that feed into the existing Session 2 batch UI for one-screen review + save. Promoted from "OPTIONAL" once manual entry was confirmed sustainable only at <100 refs/sitting (decision record `005-scripture-refs-bulk-and-ocr-design.md`). **Trigger for prioritizing:** first time you have 100+ unentered refs from a single reading session, or a growing backlog of page photos — the trip corpus is the natural stress test. **Build may continue during the trip** (deploy window + secrets); only shelf-bound QA waits for August._

_Schema hooks (`source_image_url`, `confidence_score`, `needs_review`, `review_note`), the `library-scripture-images` storage bucket, and the batch-form ingest surface are already shipped — Session 9 is provider + Edge Function + `/library/review` surfacing + smoke._

_Order in the arc: lands AFTER Session 7 (shipped) and BEFORE Session 8 (Turabian) so OCR-extracted refs feed citation work. Trip-period constraint: **no dependency on books left in storage**._

| Task | Done | Notes |
|------|:----:|-------|
| Re-confirm OCR design from `docs/decisions/005-scripture-refs-bulk-and-ocr-design.md` matches current workflow before building (provider choice, draft-rows-only writes, confidence threshold). | ☑ | 2026-05-04 pre-read; **015** + stub contract. |
| Decision: OCR provider — Tesseract via Edge Function vs external API (Google Vision / AWS Textract / Anthropic). | ☑ | **015:** MVP default **Anthropic Claude**; criteria for alternatives documented. |
| Edge Function for OCR — input: bucket object path + mime, output: `{ rawText, candidates: [{ bible_book, chapter_start, …, confidence_score }] }`. | ☑ | **`ocr_scripture_refs`** — Anthropic vision + JSON parse (**021**); `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_OCR_MODEL`) via Supabase secrets. |
| Parser for OCR text → structured scripture_reference candidates. | ☑ | **Structured output** from Claude in Edge (not a separate Tesseract path). |
| Confidence threshold — pre-flag `needs_review = true` when `confidence_score < 0.80`. Adjustable in settings. | ☑ | **0.80** in batch form when mapping candidates; settings knob still Session 10. |
| "Extract from image/file" button inside `<ScriptureReferenceForm>` (batch mode) — triggers the Edge Function on the already-uploaded image, populates draft rows from the candidate array. | ☑ | **Extract from image** + `?/extractScriptureRefs` (2026-05-04). |
| Review queue UI — surface `scripture_references` with `needs_review` on `/library/review`. | ☑ | Lightweight deep-link list (up to 50) below the books card stack — **021**; `/library` filter chips deferred. |
| Smoke test — upload 5 sample page images, verify OCR pipeline → draft rows → review + save flow. | ☐ | **Owner** after `npm run supabase:deploy-functions` + secrets — see **021**. |

**Acceptance:**
- [x] Image upload + "Extract from image/file" populates draft rows in `<ScriptureReferenceForm>` with `needs_review = true` (when confidence < 0.80) and `confidence_score` populated per row. _Anthropic-backed Edge + client mapping + batch insert (**021**)._ 
- [x] No `scripture_references` row is INSERTed by the OCR path until the user clicks Save in the batch UI. _OCR path returns JSON only; inserts only via `createScriptureRefsBatch`._
- [x] Low-confidence (< 0.80) entries surface in the review queue post-save; owner can confirm or reject on the book detail page via `/library/review` deep links. _List on `/library/review` + `#ref-` hash scroll (**021**); one-tap "clear needs_review" remains inline edit on detail._
- [ ] Smoke test passes on 5 sample images with mixed quality. _Owner hands-on after deploy (**021**)._
- [x] `npm run check` passes (2026-05-16)
- [x] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit _N/A — no migration this slice_
- [x] `docs/decisions/NNN-<slug>.md` filed — **015** (kickoff) + **021** (Anthropic wired + trip policy)
- [ ] viewer can upload images and trigger OCR; viewer cannot confirm low-confidence entries on owner's rows (only own rows per S1) — tested by signing in as the viewer user

---

## Open Questions — Library (Session-Blocking Globals)

_Session-blocking. Resolve before the dependent session starts. Per-entity questions live in the Session 0 decision record (`001-library-session-0-audit.md`), not here._

| # | Question | Status |
|---|---|---|
| 1 | `@zxing/browser` confirmed on actual phone, or does the 30-min spike reveal issues? | ☑ **Deferred to device smoke** (2026-05-01) — `/library/add` ships with manual ISBN fallback + camera-denied messaging. Record phone model / outcome when you run the Session 6 script; see `docs/decisions/011-library-session-6-mobile-and-barcode.md`. |
| 2 | Open Library API rate limits — `enrich_library.py` full 1,330-book run hit any throttling? | ☑ Resolved 2026-04-30 — full 1,330 rows enriched at 0.6s/req with no throttling. Match-type breakdown: title+author 749 (56.3%) / title-only 294 (22.1%) / no-match 287 (21.6%). |
| 3 | Image upload max size / client-side compression before Supabase Storage? | ☑ Resolved Session 2 (2026-04-28) — bucket `library-scripture-images` private, 10 MB cap, mimes `jpeg/png/webp/heic`. Path `${userId}/${bookId}/${ulid}.${ext}` with first-segment self-prefix RLS check. Client-side downscale to ~2048px JPEG @ q=0.85 via `createImageBitmap`+canvas (HEIC fallback uploads original). Signed URLs (1h TTL) generated server-side per load. See `docs/decisions/004-library-scripture-references-wiring.md`. |
| 4 | Bibliography export format — plain text only, or add markdown + .docx? | ☑ **Resolved 2026-05-16** — **HTML + plain-text clipboard, no file export.** Copy buttons (book detail + bibliography builder) write `text/html` carrying `<i>` italics + em-dashes so Word paste preserves Turabian formatting; plain-text fallback for code editors. Bibliography builder = same clipboard shape at N-books scale. Implemented in Session 8. |
| 5 | Article-level citations (essays UI) — needed for fall semester or deferrable? | ⏳ **Trip-period observational task** — evaluate during the trip with the ~200 traveling books. If essay-level citations create real friction in sermon prep or paper drafting, promote essays UI up the post-trip queue; otherwise keep deferred per PostBuild #1. |
| 6 | Subject vs genre terminology — reconcile `Library_Migration_Notes.md` ("subject") with schema (`genre`) | ☑ **Resolved 2026-05-16** — terminology is unified on `genre` in code, schema, UI, and the v2 spreadsheet. `Library_Migration_Notes.md` retains historical "subject" wording as a Pass-1 artifact; the importer is retired per Q8 so no further reconciliation is needed. |
| 7 | OCR provider choice (Session 9) | ☑ **Resolved 2026-05-04** — MVP default Anthropic Claude (vision / structured output); alternatives + criteria in [`docs/decisions/015-library-session-9-ocr-kickoff.md`](decisions/015-library-session-9-ocr-kickoff.md). |
| 8 | Pass 2 trigger — when does the v2 (corrected) scholarly-core spreadsheet get authored? | ☑ **Resolved 2026-05-16** — v2 spreadsheet loaded directly to prod May 2026; the **database is now source of truth**. Future edits live in ppp (`/library/review`, `<BookForm>`), not in a spreadsheet. Pass 2 importer path retired. See decision 022. |
| 9 | Pass 1 ISBN coverage from `enrich_library.py` — high enough to ship the optional `books_isbn_uniq` partial unique index? | ☑ Resolved 2026-04-30 — 65.8% (875/1,330). Below the 70% threshold from decision 007. **SKIPPED for Pass 1**; will revisit pre-Pass-2 once the v2 spreadsheet has chased down missing ISBNs on the scholarly core. See `docs/decisions/008-library-pass-1-import.md`. |
| 10 | Audit attribution — does `auth.uid()` propagate to `audit_log_trigger` from a service-role client, or do we need the post-apply `UPDATE audit_log` fallback? | ☑ Resolved 2026-04-30 — **fallback is required**. `auth.uid()` returns NULL under service-role, so trigger writes `changed_by = NULL`. `scripts/library-import/patch-audit.ts` patches the window. Same pattern needed for any future bulk-import via service-role. Side-effect: the B1/B2 viewer-column trigger on `personal_notes` / `rating` ALSO blocks UPDATEs (since `app_is_owner()` evaluates to false), so post-apply patches must drop those columns from the payload. See decision 008 Surprise #9. |
| 11 | Genre vs `primary_category_id` long-term role on `/library` filters — keep both, or drop Category as redundant? | ☑ **Resolved 2026-05-16 (superseded by Q12)** — Session 5 dropped the Category facet; Q12 collapses the structural duplication entirely. See decision 022. |
| 12 | Collapse genre + category into a single content-type taxonomy — drop `categories` / `book_categories` / `books.primary_category_id`? | ☑ **Resolved 2026-05-16** — yes; genre becomes the single content-type axis; `books.shelving_location` (TEXT) is the physical-location escape hatch. Category → Genre backfill landed via migration `<timestamp>_library_backfill_genre_from_category.sql`; structural removal in `<timestamp>_library_drop_categories.sql`. See decision 022. |

---

## Notes

_For cross-cutting standards, see `AGENTS.md` and `.cursor/rules/`. Everything below is library-specific._

### Living artifacts

Whenever a session produces:
- A new reusable component → update `.cursor/rules/components.mdc`
- A new schema-shape gotcha → update `.cursor/rules/db-changes.mdc`
- A new library-specific pattern → update `.cursor/rules/library-module.mdc`
- Any non-obvious decision or surprise → file `docs/decisions/NNN-<slug>.md`

The tracker is forward-looking; the rules and decision log absorb what we learn.

### Trip-driven sequencing

- The pre-trip arc front-loads the **research surface**, not the citation surface. Search-first per `.cursor/rules/library-module.mdc`. Sermon prep workflow ships in Session 3 (against fixtures) and gets real data in Session 4.
- Session 1 ships books-with-junctions as the vertical slice — Session 0 decision 5d corrected an earlier draft that scoped Session 1 to books-alone. Library is search-first, and search needs author data.
- Session 2's `<SourcePicker>` + `<CanonicalizingCombobox>` are deliberate component investments. Session 5 will reuse both with zero new polymorphic primitives. If Session 5 ends up writing polymorphic code, Session 2 failed.
- Session 4 (migration) is the high-variance session in the pre-trip arc. Search and CRUD already work against fixtures by then, so a migration spill doesn't block the system.
- **Session 5.5 (review queue UI) was originally planned to land between 5 and 6** — added 2026-04-30 after Pass 1 surfaced 1,169 `needs_review = true` rows. The trip-period workflow needs a friction-free way to drain that queue from a phone; the existing list page's `?needs_review=true` filter is fine for desktop but not for batch work. Session 6's mobile-polish smoke test then exercises the new surface, so the two slot together cleanly. **Actual order shipped: 4 → 5.5 → 5 → 6.** 5.5 jumped the queue because its acceptance bar (drain 50 books in 5 min from a phone) was the hard gate for the trip; Session 5's topic/coverage primitives + filter polish are still required pre-trip but weren't blocking review-queue work.
- Session 6 includes the **raw-field copy** affordance — not Turabian, just clipboard helpers for hand-rolled summer citations. Cheap insurance against summer paper drafting needs.
- The trip period is **active use + optional build**: data entry, reading status, book + scripture review queues; OCR / Edge / pure-function Turabian work when you have a deploy window. **Shelf-bound** Pass 2 + physical spot-checks wait for August. **Avoid DB migrations** on the road unless necessary; Edge deploys are fine.

### Trip-period + post-trip ordering

- **Order: 7 → 9 → 8.** Session 7 **shipped 2026-05-02**; remaining checklist item is **viewer smoke** (Session 7 acceptance). **Session 9 (OCR)** then **Session 8 (Turabian + Turabian-first `/library/review`)** — translator structure is in `book_authors`. **Both 9 and 8 may progress during the trip** if work does not require a book left in Madison.
- Session 9 (OCR) processes page photos; promoted to required 2026-04-29 (`docs/decisions/005-scripture-refs-bulk-and-ocr-design.md`). **Prioritize** when ref backlog is large; no "wait until August" gate for **implementation** (see **021** + trip policy).
- Session 8 (Turabian) is pure-function work — **implementation + unit QA** can run during the trip; **full scholarly-core citation QA** may wait until the traveling shelf + v2 data are home.
- **Session 4 Pass 2** — spreadsheet-owned field reconciliation + shelf spot-checks: **August** (blocked on v2 sheet + full library access).
- **Session 8.5** (optional) — review-queue polish only (swipe, haptic, animation, microcopy) if deferred from Session 8; same plan doc.

### Library-specific gotchas

- Page numbers are TEXT, not INT — schema handles `IV.317`, `xiv`. Every citation formatter must not coerce.
- Overlap search is the default query mode for scripture references; exact match is opt-in. Inclusive on both boundaries.
- Volumes are discrete book records, not reference-table rows. Multi-volume sets = N books with shared `series_id` + distinct `volume_number`.
- The `confidence_score` + `needs_review` + `review_note` fields handle low-confidence imports exception-based — no formal review workflow needed.
- ESVEC pattern for multi-contributor volumes until essays UI ships: editors in `book_authors`, contributors noted in `personal_notes`. Article-level citations require essays UI (deferred, see PostBuild #1 and Open Question 5).
- **Translators (post–Session 7):** TDNT / Joüon–Muraoka (and related overrides) now have `book_authors` rows with `role = 'translator'`; migrated rows had translator prose removed from `personal_notes`. Session 8 Turabian should read translators from `book_authors` only. ESVEC and other edge cases may still use `personal_notes` until essays UI.
