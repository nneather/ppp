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

_Last updated: April 25, 2026 | Module: Library (2nd) | **Pre-trip target: late May 2026 (sermon-prep-ready)** | **Post-trip target: late August 2026 (Turabian + fall-semester-ready)**_

---

## Critical Path — Reframed

The trip changes the deadline geometry:

- **Pre-trip checkpoint (late May):** library is **research-ready** for summer sermon prep. Search-first surface lights up. Turabian, OCR, and academic polish are NOT in scope.
- **10-week away period (late May → early August):** library is in active use for sermon prep + light academic reading. Schema and data are stable; only mobile-friendly content tasks happen on the road (review queue, reading status updates, scripture reference entry).
- **Post-trip checkpoint (late August / early September):** Turabian citations land before fall semester starts. Settings polish + permissions UI ship. OCR is opt-in if there's time.

The September seminary start was the original hard deadline. With Turabian moved post-trip, the **real** pre-trip hard requirement is "sermon-prep-ready" — passage search returns the right commentaries, and book-level metadata is trustworthy enough to copy/paste into a manual citation when needed.

Pre-trip arc: **6 sessions** in ~10 working days. Post-trip arc: **3 sessions** in the ~2-week buffer between return and fall semester.

---

## Pre-Session Checklist

- [ ] **`docs/POS_Library_Session_0.md` complete** — schema audit signed off, Open Questions ≤ 2 unresolved per entity, viewer seeded with curl proof, decision points 5a–5d locked. _(Audit doc filed at `docs/decisions/002-library-session-0-audit.md`; viewer seed pending Round 2 UUID paste-in.)_
- [x] Decision points locked (per the Session 0 doc, with this tracker's choices):
  - **5a (OCR):** out for pre-trip. Schema hooks remain (`source_image_url`, `confidence_score`, `needs_review`); ingest pipeline deferred to post-trip Session 9 (optional) or later.
  - **5b (ancient_texts canonicalization):** seed canonical list in Session 0; inline `<CanonicalizingCombobox>` in Session 5; Settings CRUD page in Session 7.
  - **5c (component naming):** `<SourcePicker>` for polymorphic `(book_id OR essay_id)`; `<CanonicalizingCombobox>` for `ancient_texts.canonical_name + abbreviations[]` and `book_topics.topic` autocomplete. Names registered in `.cursor/rules/components.mdc`.
  - **5d (Session 1 scope):** books CRUD + people junctions + categories + series — full vertical slice with junctions, not books-alone.
- [ ] Scholarly core review complete in Claude — all CMT / BBL / REF / LGK / LHB corrections merged into `Library_Migration_Notes.md`.
- [ ] Deferred shelf-check items resolved — Calvin CC vols 2 & 3, Bruce NICNT Acts edition, Hodge 1 Cor reprint, Douglas *New Bible Dictionary* edition.
- [ ] BDAG migration row drafted (missing from xlsx).
- [ ] `enrich_library.py` run against the scholarly core — metadata merged into migration CSV.
- [ ] `@zxing/browser` 30-minute spike passes on actual phone before Session 6.
- [ ] Turabian skill (`SKILL.md` + `formats.md`) loaded into the build context before **Session 8** (post-trip).
- [x] Invoicing module complete — carry-forward inventory in `AGENTS.md` verified.

---

# Pre-Trip Arc — Sermon-Prep-Ready

_Ends with: passage search works against ~1,288 books, mobile scripture-reference entry is friction-free, book CRUD + barcode add are in your pocket. Citations are still manual; the trip-period workflow is "find → read → enter references" not "find → cite."_

---

## Session 1 — Books + People + Categories + Series Vertical Slice (4–5h)

_Goal: First real CRUD surface ships with junctions. Library's primary entity (`books`) lands with full author + category + series wiring so seed data and migration in Session 4 have somewhere to land. Per Session 0 decision 5d._

| Task | Done | Notes |
|------|:----:|-------|
| Apply `library_delta_v1.sql` migration (queued in Session 0) to staging then prod | ☑ | Applied 2026-04-25 via `supabase db push`. Bundled with `20260425170000_books_viewer_column_protection.sql` (Track D B1/B2 trigger), `20260425180000_search_scripture_refs.sql` (Session 2 SQL function), and `20260425190000_audit_log_composite_pk_fix.sql` (junction-table audit fix surfaced by smoke seed — see `docs/decisions/003-library-books-vertical-slice.md` Surprise #6). `npm run supabase:gen-types` still pending. |
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
- [ ] Owner can list → view → create → edit → soft-delete → undo a book end-to-end on desktop and phone — _Session 1.5 fixed the detail-page-delete 404; pending fresh hands-on smoke test_.
- [ ] Add a new book with 2 authors (different roles), 3 categories (1 primary), series + volume → 2 `book_authors` rows, 3 `book_categories` rows, `series_id` + `volume_number` populated — _Session 1.5 reworked the author picker as `<PersonAutocomplete>` (typeahead + inline create); pending hands-on smoke test_.
- [ ] Edit flow: remove 1 author, add 1 editor, reorder remaining → junction rows reflect exactly the new state; audit log shows 1 DELETE + 1 INSERT + N UPDATEs — _pending hands-on smoke test; audit log entries now show entity name (book title) prominently per Session 1.5 polish_.
- [ ] B14 canonicalization combobox prompt fires when creating a person whose last_name + first_initial match an existing person — _Session 1.5 added pre-flight warning in the Add-person Dialog plus an inline `<PersonAutocomplete>` warning per result; pending hands-on smoke test (full `<CanonicalizingCombobox>` is Session 5)_.
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
| `<ScriptureReferenceForm>` on book detail — wraps `<SourcePicker>` (auto-populated to current book); fields: bible_book, chapter_start, verse_start, chapter_end, verse_end, page_start, page_end, needs_review, review_note, source_image_url (manual upload, no OCR) | ☑ | Wired into `/library/books/[id]` Session 2 (2026-04-28). Per-row inline-toggle Edit, ConfirmDialog-gated soft-delete with optimistic remove, refs grouped by `bible_book` in canon order. Image upload via browser supabase client → `library-scripture-images` bucket (Open Question 3 resolved); object path stored, signed URL (1h TTL) generated server-side per load. |
| Verify `compute_verse_abs` trigger fires on INSERT and on UPDATE of any chapter/verse column | ☑ | Explicit `BEGIN; … ROLLBACK;` SQL assertion at [`supabase/diagnostics/library_compute_verse_abs_update_path.sql`](../supabase/diagnostics/library_compute_verse_abs_update_path.sql). Tests INSERT baseline + 4 UPDATE paths (verse_start toggle, chapter_end+verse_end set, collapse to chapter-only, collapse to whole-book). RAISE EXCEPTION on mismatch with step number + observed values. _User runs this once in Studio post-deploy._ |
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
| Faceted filter UI — genre, category, series, language, reading_status, needs_review | ☐ | AND between types, OR within. Chips above list, removable. Clear-all button. |
| URL param sync — `?genre=Commentary&series=NICNT&needs_review=true` | ☐ | Deep-linkable. Back button works. |
| Search input — title + subtitle + author last_name (via book_authors JOIN) | ☐ | Trigram index on `books.title`. Debounce 200ms. |
| `/library/search-passage` — bible_book select + chapter input + verse input → `search_scripture_refs()` | ☐ | Results: book title, page_start, confidence badge if present. Manual entries sort first. |
| Result deep link — clicking a result opens source book detail scrolled to the scripture_reference | ☐ | `/library/books/[id]#ref-<uuid>` anchor. |
| "Showing N of 1,288" count indicator | ☐ | Updates on filter change. |
| Mobile layout — list uses cards on narrow screens; facets collapse to bottom sheet | ☐ | Test on phone. Thumb-reachable controls. **This is the surface you'll actually use on the trip.** |

**Acceptance:**
- [ ] `/library` renders fixture data with <500ms filter response.
- [ ] Scripture passage search returns the expected 3 rows for "Philippians 2:5" against Session 2 fixture.
- [ ] URL params round-trip: open `/library?genre=Commentary&needs_review=true`, back + forward — state preserved.
- [ ] Deep link from passage search result to book detail scrolls to the correct scripture_reference block.
- [ ] Mobile list tested on actual device; one-hand thumb operation confirmed for filter + search + passage entry.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer can filter + keyword-search + passage-search and sees identical results to owner (no RLS-hidden rows) — tested by signing in as the viewer user

---

## Session 4 — Scholarly Core Migration (4–6h) [HIGH-VARIANCE]

_Goal: ~1,288 books land in prod. Sessions 5–6 then run against real data instead of fixtures. The pre-trip search surface (Session 3) was already proven against fixtures — if migration spills to a second sitting, the system stays usable._

_Highest-variance session in the pre-trip arc. Budget 4–6h; plan for 6–8h. Don't compress corrections to fit._

| Task | Done | Notes |
|------|:----:|-------|
| Build migration CSV from `Library_Migration_Notes.md` — every correction (status case, multi-author splits, title typos, edition extraction, subject → genre reclassifications, volume numbers, series assignments, ESVEC pattern) | ☐ | CSV columns include authors array with role + sort_order. |
| Merge BDAG and other Data Additions Needed rows | ☐ | Per Library_Migration_Notes. |
| Add `needs_review_note` values for imports that couldn't be fully resolved | ☐ | Deferred shelf-check items: `needs_review = true` + specific note. |
| Run `enrich_library.py` against scholarly core — Open Library metadata (isbn, publisher, year, page_count) merged into CSV | ☐ | One-time pass before import. |
| Import script — local node script using service_role key, transactional per batch of 50 | ☐ | Rollback on any row failure. Idempotent via title + first-author dedup. |
| Person creation — dedup by last_name + first_initial + middle_initial before INSERT | ☐ | B14 logic at migration time. |
| Junction row creation — book_authors (role, sort_order), book_categories (primary + secondary), series_id + volume_number | ☐ | Transactional per book. |
| Subject → genre rewrites — LHB → BRF for TWOT, no-subject → BRF for ABD/TDNT/IVP/Oxford/etc. per PostBuild #3 | ☐ | Genre mapping table embedded in script. |
| General library import (~1,020 books, `needs_review = true`, minimal cleaning) | ☐ | Genre inferred where possible; NULL triggers `needs_review = true`. |
| Translator workaround — translators in `personal_notes` until structured migration ships post-trip | ☐ | Geoffrey Bromiley (TDNT), Muraoka (Joüon/Muraoka). |
| Post-import validation queries | ☐ | `SELECT genre, COUNT(*) FROM books WHERE needs_review = false GROUP BY genre`. `COUNT(*) FROM books` ≈ 1,288. Zero FK violations. |
| Spot-check 20 random rows against `Library_Migration_Notes.md` | ☐ | Manual QA. |
| Audit log sanity — imported rows have `changed_by = <owner_id>`, not NULL | ☐ | Import script must set user context. |

**Acceptance:**
- [ ] Prod `books` count ≈ 1,288. Scholarly core (genre in Commentary / Bibles / Biblical Reference / Greek-Hebrew-Latin-German-Chinese Language Tools) with `needs_review = false` ≥ 250.
- [ ] 20-row spot-check passes — zero data-integrity errors in authors, series, volume, genre. (Citation correctness is post-trip; data correctness is now.)
- [ ] Audit log contains per-book INSERT rows attributed to owner.
- [ ] `/library` list loads 1,288 rows under 500ms with Session 3 filters applied.
- [ ] `/library/search-passage` against Phil 2 still returns the fixture rows (will return real data once Session 5 wires `book_bible_coverage`).
- [ ] Zero FK violations across book_authors, book_categories, series_id, primary_category_id.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer sees all 1,288 books, can filter `needs_review = true`, and can start the review queue from the road — tested by signing in as the viewer user

---

## Session 5 — Topics + Coverage + `<CanonicalizingCombobox>` (3–4h)

_Goal: Research-indexing primitives (`book_topics`, `book_bible_coverage`, `book_ancient_coverage`) ship via the `<SourcePicker>` from Session 2 — no new polymorphic primitives. Inline `<CanonicalizingCombobox>` lands for ancient_texts (deferring the Settings CRUD page to post-trip Session 7). Topic autocomplete with trigram-typo warning ships._

| Task | Done | Notes |
|------|:----:|-------|
| Build `<CanonicalizingCombobox>` — fuzzy match against `canonical_name` + `abbreviations[]`, "Did you mean X?" prompt, inline create-as-you-go callback | ☐ | Per Session 0 decision 5c. Reused by `book_topics` (Session 5), `book_ancient_coverage` (Session 5), and Settings ancient_texts CRUD (Session 7). Register in `.cursor/rules/components.mdc`. |
| `<BookTopicForm>` on book detail — reuses `<SourcePicker>` and `<CanonicalizingCombobox>` for topic autocomplete | ☐ | Topic autocomplete with T2 trigram-typo warning: if `similarity(new, existing) > 0.7` and new topic has < 3 uses, warn "Did you mean 'christology'?" |
| `book_bible_coverage` multi-select on book detail — multi-select of `bible_books` (66 seeded). Reuses `<SourcePicker>` for parent. | ☐ | Drives commentary surfacing in passage search. |
| `book_ancient_coverage` multi-select — `<CanonicalizingCombobox>` against `ancient_texts` with inline create | ☐ | Inline create writes new `ancient_texts` rows; viewer permissions per A2 (owner-only create — viewer just selects existing). |
| Zero new polymorphic-handling code — prove with grep | ☐ | `grep -r "book_id.*OR.*essay_id" src/lib/library/*` returns only Session 2's `polymorphic.ts`. |
| Wire `book_bible_coverage` into `search_scripture_refs()` so a book covering the whole of Philippians surfaces on any Phil chapter/verse search | ☐ | Schema-level: scripture_references already does this. App-level: confirm coverage rows count for surfacing on book list when filtered by passage. |

**Acceptance:**
- [ ] Topic, bible coverage, and ancient coverage entry all use `<SourcePicker>` from Session 2 — zero new polymorphic primitives.
- [ ] `<CanonicalizingCombobox>` works for both `ancient_texts` (multi-source autocomplete + inline owner-create) and `book_topics.topic` (with typo warning).
- [ ] `/library/search-passage` against Phil 2 returns commentaries that have `book_bible_coverage` rows on Philippians, in addition to scripture_references hits.
- [ ] Topic autocomplete prevents fragmentation — typing "chrisology" surfaces existing "christology" warning.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer can INSERT topics + bible coverage + ancient coverage; viewer cannot create new ancient_texts rows via the inline combobox (owner-only per A2; viewer sees existing entries only); viewer cannot DELETE — tested by signing in as the viewer user

---

## Session 6 — Mobile Polish + Barcode Add + Dashboard Tile + Raw-Field Copy (3–4h)

_Goal: The trip-period workflow ships. Three flows must be friction-free on phone: passage search, scripture reference entry during reading, and barcode-add-to-library. Plus a small "raw field copy" affordance for any summer paper drafting that can't wait for full Turabian._

| Task | Done | Notes |
|------|:----:|-------|
| Mobile pass on `/library/search-passage` — one-hand thumb operation, large touch targets, results card layout | ☐ | This is the most-used summer flow. Test on actual phone. |
| Mobile pass on `<ScriptureReferenceForm>` — bible_book select uses bottom sheet, chapter/verse inputs are numeric keyboards, image upload is camera-capable | ☐ | Image upload remains manual (no OCR pre-trip). |
| Mobile pass on `<BookFormSheet>` add flow — full-screen sheet on mobile, comfortable to fill quickly | ☐ | |
| `@zxing/browser` integration on `/library/add` | ☐ | Camera permission flow, scan ISBN, lookup via Open Library API, pre-populate form. |
| Confirm-before-save on barcode-populated form | ☐ | Open Library metadata can be wrong; always let user review. |
| Manual ISBN fallback — text input invokes same Open Library lookup | ☐ | When camera permission is denied. |
| Dashboard library tile — live count of total books + needs_review count, deep link to `/library?needs_review=true` | ☐ | Matches invoicing tile pattern per `AGENTS.md`. |
| **Raw-field copy buttons on book detail** — Copy "Author Last, First" / Copy "Title" / Copy "Publisher, Year" / Copy "All Fields" (concatenated `${author} ${title} ${publisher} ${year} ${page_count}`) | ☐ | Not Turabian. Just clipboard helpers for hand-rolling citations during summer drafting. Cheap insurance per the prior conversation. |
| Full pre-trip smoke test on phone — sign in → filter `?needs_review=true` → open a flagged book → clear flag → run `/library/search-passage` for Phil 2:5 → open a result → add a new scripture_reference → scan a new book via barcode | ☐ | Real device, real use, end-to-end on the workflow you'll actually use on the trip. |

**Acceptance:**
- [ ] Passage search, scripture reference entry, and barcode-add all work one-handed on phone.
- [ ] Barcode scan populates book form in < 5 seconds; confirms before save.
- [ ] Manual ISBN fallback works when camera permission is denied.
- [ ] Dashboard library tile shows live counts; deep link works.
- [ ] Raw-field copy buttons render correct concatenated strings to clipboard with toast confirmation.
- [ ] Full smoke test executed on phone; trip-period workflow is friction-free.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer can run the full trip-period workflow end-to-end on phone — tested by signing in as the viewer user

---

# Trip Period — System in Active Use

_Late May → early August. No build sessions. The library is in active use for sermon prep and reading. Schema and data are stable; only mobile-friendly content tasks happen on the road:_

- Pulling up commentaries on a sermon passage via `/library/search-passage`
- Entering scripture references while reading commentaries
- Updating reading status on books
- Working through the no-subject review queue (~1,020 books) in spare time
- Adding new books via barcode if you pick anything up while traveling
- Hand-rolling any citations needed for summer paper drafting using the raw-field copy buttons

If something breaks while away, the system degrades to "search-but-can't-edit" cleanly — RLS keeps data safe, and read-only browsing still works on phone. Don't deploy migrations during the trip period unless absolutely necessary.

---

# Post-Trip Arc — Turabian + Settings + Optional OCR

_Returns the system to pre-fall-semester readiness. Two-week buffer between return and fall start absorbs Session 8 (the original September deadline). Sessions 7 and 9 are flexible — Session 7 can spread across early August, Session 9 is opt-in._

---

## Session 7 — Settings Polish: People Merge + Ancient Texts CRUD + Permissions (3h)

_Goal: Settings surfaces that involve owner-only operations land. People merge, ancient_texts CRUD page (the inline combobox shipped pre-trip in Session 5), and permissions UI._

| Task | Done | Notes |
|------|:----:|-------|
| `/settings/library/people` — list, search by last name, edit, **soft-delete**, **merge (owner-only)** | ☐ | Merge: pick canonical + merged-away → re-point `book_authors` → soft-delete merged-away person. Audit log: non-revertible. Reuses canonicalization combobox pattern. **Promoted to first-class (Session 1.5i note):** quick-created people from book form (Session 1.5f+) need a manageable list — review, rename, soft-delete, merge — to keep authoring quality from drifting as the library grows. |
| `/settings/library/series` — list + edit polish (CRUD already works via inline create from book form) | ☐ | Allows renaming + abbreviation correction. Series with books attached cannot be hard-deleted. |
| `/settings/library/ancient-texts` — full CRUD page + **merge (owner-only)** | ☐ | Inline create already shipped in Session 5. This page adds list view, edit (canonical_name + abbreviations[] + category), and the merge action with confirmation modal: "This will re-point N book_ancient_coverage rows and cannot be reverted." Require typing canonical name to confirm per A1. |
| Translator data migration — move translator names from `personal_notes` into `book_authors` rows with `role = 'translator'` | ☐ | Per PostBuild #2 reclassification. ~10–15 books affected. Sets up Session 8's Turabian generator to read translators from structured data. |
| `/settings/permissions` — owner-only view of `user_permissions` | ☐ | Toggle viewer module access (library = write / read / none; same for calendar, invoicing, projects). |
| `/settings/library/genres` + `/settings/library/categories` + `/settings/library/bible-books` — read-only displays | ☐ | ~15 min total. Schema CHECK + seed data are sources of truth. |
| Audit log verification — after a people merge and an ancient_texts merge, the existing audit log UI shows entries as non-revertible with diff visible | ☐ | Validates that the invoicing-era audit UI handles these patterns end-to-end. |

**Acceptance:**
- [ ] People CRUD works end-to-end; merging two people re-points all `book_authors` rows + logs non-revertible audit entry.
- [ ] Ancient texts CRUD works; merging two `ancient_texts` re-points all `book_ancient_coverage` rows, soft-deletes merged-away, logs non-revertible merge entry + N non-revertible coverage updates.
- [ ] Translator data migration: scholarly-core books with translators (TDNT, Joüon/Muraoka, etc.) have `book_authors` rows with `role = 'translator'`; `personal_notes` translator strings cleared.
- [ ] Owner can toggle viewer's library access between write / read / none; change takes effect on next viewer page load.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer cannot trigger the people-merge action (UI hidden, backend 403); viewer cannot CREATE / EDIT / MERGE ancient_texts; viewer cannot access `/settings/permissions` (403) — tested by signing in as the viewer user

---

## Session 8 — Turabian Citations + Bibliography Builder (4–5h) [SEPTEMBER CHECKPOINT]

_Goal: The original September deadline. Turabian footnote + bibliography generation for every scholarly-core book. Pure-function module against locked schema and locked data — zero variance once you sit down to it. Translator role is now structured (post-Session 7 migration), so no more `personal_notes` workaround._

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

**Acceptance:**
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

## Session 9 — OCR Pipeline (4–6h) [OPTIONAL — only if time permits before fall]

_Goal: Automated extraction from `source_image_url` images into structured `scripture_references`. Schema hooks (`source_image_url`, `confidence_score`, `needs_review`, `review_note`) already in place since Session 0. This session adds the ingest pipeline._

_Run this only if Sessions 7 + 8 finish ahead of fall semester start with real buffer. If not, defer to spring break or later — manual entry from images (shipped in Session 2) is sufficient indefinitely._

| Task | Done | Notes |
|------|:----:|-------|
| Decision: OCR provider — Tesseract via Edge Function vs external API (Google Vision / AWS Textract / Anthropic). Document tradeoffs. | ☐ | External API simpler for MVP; Tesseract is self-hosted. Anthropic is convenient given existing API key but rate limits + cost matter for batch image runs. |
| Edge Function for OCR — input: `source_image_url`, output: raw text + confidence score | ☐ | Per `.cursor/rules/edge-functions.mdc`. |
| Parser for OCR text → structured scripture_reference candidates | ☐ | LLM-based (function calling) is highest quality. Validate output against schema before INSERT. |
| Confidence threshold — set `needs_review = true` when `confidence_score < 0.80`. Adjustable. | ☐ | Per S10. |
| Review queue UI — extends Session 3's `?needs_review=true` filter to surface scripture_references entries (not just books) | ☐ | New filter chip group: "Books needing review" + "Scripture refs needing review". |
| Smoke test — upload 5 sample page images, verify OCR pipeline → review queue → manual confirmation flow | ☐ | Real-use validation. |

**Acceptance:**
- [ ] Image upload triggers OCR + parsing; structured scripture_reference candidates land with `needs_review = true` and confidence_score populated.
- [ ] Low-confidence (< 0.80) entries surface in review queue; owner can confirm or reject one-click on phone.
- [ ] Smoke test passes on 5 sample images with mixed quality.
- [ ] `npm run check` passes
- [ ] If a migration was added: `npm run supabase:gen-types` ran and `src/lib/types/database.ts` is in the same commit
- [ ] `docs/decisions/NNN-<slug>.md` filed using the `AGENTS.md` template
- [ ] viewer can upload images and trigger OCR; viewer cannot confirm low-confidence entries on owner's rows (only own rows per S1) — tested by signing in as the viewer user

---

## Open Questions — Library (Session-Blocking Globals)

_Session-blocking. Resolve before the dependent session starts. Per-entity questions live in the Session 0 decision record (`001-library-session-0-audit.md`), not here._

| # | Question | Status |
|---|---|---|
| 1 | `@zxing/browser` confirmed on actual phone, or does the 30-min spike reveal issues? | ☐ Open — resolve before Session 6 |
| 2 | Open Library API rate limits — `enrich_library.py` full 1,288-book run hit any throttling? | ☐ Open — resolve during pre-Session 4 enrichment run |
| 3 | Image upload max size / client-side compression before Supabase Storage? | ☑ Resolved Session 2 (2026-04-28) — bucket `library-scripture-images` private, 10 MB cap, mimes `jpeg/png/webp/heic`. Path `${userId}/${bookId}/${ulid}.${ext}` with first-segment self-prefix RLS check. Client-side downscale to ~2048px JPEG @ q=0.85 via `createImageBitmap`+canvas (HEIC fallback uploads original). Signed URLs (1h TTL) generated server-side per load. See `docs/decisions/004-library-scripture-references-wiring.md`. |
| 4 | Bibliography export format — plain text only, or add markdown + .docx? | ☐ Open — plain text is floor; decide at Session 8 |
| 5 | Article-level citations (essays UI) — needed for fall semester or deferrable? | ☐ Open — currently deferred per PostBuild #1; revisit if fall syllabus reveals essay-citation pressure |
| 6 | Subject vs genre terminology — reconcile `Library_Migration_Notes.md` ("subject") with schema (`genre`) before Session 4 | ☐ Open — doc-side fix, pre-Session 4 |
| 7 | OCR provider choice (Session 9, optional) | ☐ Open — only matters if Session 9 happens; resolve at start of Session 9 |

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
- Session 6 includes the **raw-field copy** affordance — not Turabian, just clipboard helpers for hand-rolled summer citations. Cheap insurance against summer paper drafting needs.
- The trip period is **maintenance mode**: data entry, reading status, review queue. No migrations, no schema changes. If something breaks, fall back to read-only browsing.

### Post-trip ordering

- Session 7 (people merge + ancient_texts CRUD page + permissions) lands first because the translator data migration *inside* Session 7 is what unblocks Session 8's structured-translator citations.
- Session 8 (Turabian) is pure-function work. Highest-leverage 4–5 hours in the post-trip arc — locked schema, locked data, deterministic output.
- Session 9 (OCR) is opt-in. Schema hooks already exist; the work is the ingest pipeline + parser + review queue. Skip without regret if fall pressure builds.

### Library-specific gotchas

- Page numbers are TEXT, not INT — schema handles `IV.317`, `xiv`. Every citation formatter must not coerce.
- Overlap search is the default query mode for scripture references; exact match is opt-in. Inclusive on both boundaries.
- Volumes are discrete book records, not reference-table rows. Multi-volume sets = N books with shared `series_id` + distinct `volume_number`.
- The `confidence_score` + `needs_review` + `review_note` fields handle low-confidence imports exception-based — no formal review workflow needed.
- ESVEC pattern for multi-contributor volumes until essays UI ships: editors in `book_authors`, contributors noted in `personal_notes`. Article-level citations require essays UI (deferred, see PostBuild #1 and Open Question 5).
- Pre-trip translator workaround: translators in `personal_notes`. Session 7 migrates them into structured `book_authors role='translator'` rows before Session 8's Turabian generator runs. Don't try to cite translators pre-trip — the data isn't structured yet.
