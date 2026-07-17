# ppp — Agent Operating Guide

This is the single entry point for any AI assistant working on this repo. Read this first.

**Start here for current state:** [PLAN.md](PLAN.md) — rolling one-page dashboard (current focus, active modules, recent decisions, next up). Updated at the end of every session.

The Cursor rules in `.cursor/rules/*.mdc` are loaded automatically by Cursor; if you are running outside Cursor, read them manually:

- [.cursor/rules/always.mdc](.cursor/rules/always.mdc) — stack, conventions, non-negotiables
- [.cursor/rules/workflow.mdc](.cursor/rules/workflow.mdc) — session types, end-of-session file gate, task-to-agent routing
- [.cursor/rules/db-changes.mdc](.cursor/rules/db-changes.mdc) — migration checklist
- [.cursor/rules/sveltekit-routes.mdc](.cursor/rules/sveltekit-routes.mdc) — page server / form action shape
- [.cursor/rules/edge-functions.mdc](.cursor/rules/edge-functions.mdc) — Edge Function conventions
- [.cursor/rules/components.mdc](.cursor/rules/components.mdc) — component inventory
- [.cursor/rules/hotkeys.mdc](.cursor/rules/hotkeys.mdc) — Mod+letter chord conventions
- [.cursor/rules/library-module.mdc](.cursor/rules/library-module.mdc) — library specifics
- [.cursor/rules/module-kickoff.mdc](.cursor/rules/module-kickoff.mdc) — **new module** Session 0 gates + footgun registry ([docs/MODULE_KICKOFF_PLAYBOOK.md](docs/MODULE_KICKOFF_PLAYBOOK.md))

## New module planning

Before Session 1 on any new module: read [docs/MODULE_KICKOFF_PLAYBOOK.md](docs/MODULE_KICKOFF_PLAYBOOK.md) and [docs/decisions/041-library-module-retro.md](docs/decisions/041-library-module-retro.md) (plus [000-invoicing-retro.md](docs/decisions/000-invoicing-retro.md)). Lock Phase 0 structure (taxonomy, nullability, form surfaces, RLS/viewer plan) in Session 0 — do not discover these mid-build.

**Projects (v1 complete):** [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) — schema [POS_Schema_v1.md#projects](docs/POS_Schema_v1.md#projects), Session 0 archive [POS_Projects_Session_0.md](docs/POS_Projects_Session_0.md). Library trip QA [043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md).

## Module structure (intentional asymmetry)

Library and projects extract loaders/actions to `src/lib/<module>/server/`; **invoicing keeps them inline in route `+page.server.ts` files by design** (small module, built first). Do not scaffold `src/lib/invoicing/server/` unless a session explicitly extracts it. New modules should follow the library/projects shape.

## How to start a build session

Paste this template at the top of every chat that begins a tracked session:

```
Session: <module> #N — <name>
Tracker:  <path-to-tracker>.md, Session N
Read:     AGENTS.md, .cursor/rules/<relevant>.mdc, src/lib/types/database.ts,
          docs/decisions/ (latest 3 files)
Supabase: hosted `db push` only (no local Docker stack) — [supabase/README.md](supabase/README.md)
Goal:     <one sentence>
Acceptance:
  - [ ] <copy from tracker>
  - [ ] npm run check passes
  - [ ] viewer RLS verified for any new table
  - [ ] audit_log row exists for an example write
  - [ ] mobile-width screenshot captured
End-of-session deliverables:
  - [ ] tracker session marked done with notes
  - [ ] docs/decisions/<NNN>-<slug>.md filed (use template at the bottom of this file)
```

## Carry-forward inventory (use these, do not reinvent)

### Database

- `app_is_owner()`, `app_is_viewer_writer(p_module text)` — `SECURITY DEFINER` RLS helpers. **Required** for any new RLS policy. See `supabase/migrations/20260413150000_rls_all_policies_use_helpers.sql`.
- `set_updated_at()` trigger function — attach to every table with `updated_at`.
- `write_audit_log()` trigger + `audit_log_trigger` — attach to every table.
- `generate_invoice_number()` — invoicing-specific; pattern is reusable for any sequenced display id.
- Soft delete: `deleted_at TIMESTAMPTZ`, filtered by `IS NULL` in app queries.
- All baseline objects: `supabase/migrations/00000000000000_baseline.sql`.

### Components — see [.cursor/rules/components.mdc](.cursor/rules/components.mdc) for the full inventory

### Patterns

- **Invoicing helpers** at `src/lib/invoicing/` (loaders/actions live inline in routes — see Module structure above):
  - `src/lib/invoicing/chicago-date.ts` — `ymdInChicago()`, civil-date helpers (`utcNoonFromYmd`, week/month spans, `calendarMonthContainingYmd()`), Chicago `Intl` display formatters. Use for server “today,” `/invoicing` surfaces, generate-invoice defaults, and `<TimeEntrySheet>` default date — not `toISOString().slice(0,10)` or host-local `getFullYear()` for user-facing calendar semantics.
  - `src/lib/invoicing/hours.ts` — hours math; unit tests `hours.test.ts`.
  - `src/lib/invoicing/consultation-lines.ts` — `buildConsultationLines()` pure grouping helper + label maps for per-client `consultation_grouping` ([050](docs/decisions/050-invoicing-client-billing-preferences.md)); unit tests `consultation-lines.test.ts`.
  - `src/lib/types/invoicing.ts` — `BillingCadence`, `ConsultationGrouping` + invoicing view-models.
- **Form action result shape**: `{ kind, success?, message?, <entityId>? }`. See `src/routes/settings/invoicing/+page.server.ts` for the canonical example.
- **Per-row form state**: include the entity id in the result so the page can show the error/success on the right card.
- **Multi-value text fields**: `text[]` columns + `EmailChipsEditor`-style component.
- **Per-user defaults**: column on `profiles`, not a separate table.
- **Edge Function soft-delete handling**: do not filter parents by `deleted_at` — historical artifacts must reload.
- **Audit log UI**: `/settings/audit-log` (`src/routes/settings/audit-log/`). Module-scoped via the `_INVOICING_TABLES` / `_LIBRARY_TABLES` whitelists in `+page.server.ts`. When a new module ships, extend `_LIBRARY_TABLES` (or add a new whitelist) and add the matching option to the module `<select>`. Revert is UPDATE-only and additionally gated by `_REVERTIBLE_TABLES`; library tables are intentionally excluded — see [docs/decisions/001-audit-log-ui.md](docs/decisions/001-audit-log-ui.md).
- **Hotkeys**: every primary-action button (Save, Update, Delete, Edit, Generate) needs a `hotkey` prop on `<Button>` drawn from the reserved set: `s u d e g`, plus `b` as a per-label mnemonic (e.g. "New **B**ook"). **Cancel = `hotkey="Escape"`** (bare Esc, bubble-phase, bails on `event.defaultPrevented` so open autocomplete dropdowns win). **Anchors (`href`) skip the dev-warn but can still take a hotkey.** Letters that conflict with browser/OS chords (`n t w r q l p f m h`) or with clipboard / select-all in inputs (`c x v z y a`) are explicitly NOT registered. Reserved letters live in `src/lib/hotkeys/registry.ts`. Convention + rationale: [.cursor/rules/hotkeys.mdc](.cursor/rules/hotkeys.mdc). Enforcement: dev-only `console.warn` in the Button component + `.cursor/hooks/hotkey-missing.sh` afterFileEdit hook.
- **Mobile app shell** — [src/routes/+layout.svelte](src/routes/+layout.svelte): authenticated layout is **`h-dvh overflow-hidden`**; only `<main>` scrolls (`overflow-x-hidden overflow-y-auto`); mobile tab bar is a **flex footer** (not `position: fixed` on a document-scrolling page — iOS standalone PWA detaches fixed chrome). Tailwind from [src/app.css](src/app.css): **`pb-tabbar`** on pages that need extra clearance inside `<main>`; root `<main>` uses modest **`pb-4`** on mobile since the footer does not overlay content. **`bottom-tabbar`** on **fixed** toasts/FABs only — **sticky** save bars use **`sticky bottom-0`** (not `bottom-tabbar`). See [045](docs/decisions/045-projects-session-1-tree-checkin.md), [061](docs/decisions/061-pwa-shell-isbn-author-fixes.md).
- **PWA service worker** — [src/service-worker.ts](src/service-worker.ts) (Workbox `injectManifest` via `@vite-pwa/sveltekit`): precache hashed client assets + `offline.html` only (no authenticated HTML navigate cache — see [024](docs/decisions/024-service-worker.md)); `setCatchHandler` serves offline shell on failed navigations; SWR for library vocab JSON via [`vocab-cache-paths.ts`](src/lib/library/vocab-cache-paths.ts); gated refresh via `<PwaReloadToast />` (hourly + on-resume `registration.update()`; **auto-apply waiting update on resume** — [082](docs/decisions/082-pwa-update-auto-recover.md); toast kept for mid-session discoveries). Build stamp `__APP_BUILD__` on `/settings`. Direct devDependency `workbox-window`; Vite 7 inject guard in [src/lib/vite/patch-sveltekit-pwa.ts](src/lib/vite/patch-sveltekit-pwa.ts). Light-theme chrome aligned [057](docs/decisions/057-pwa-consistency.md). **Cold-start resilience** ([072](docs/decisions/072-pwa-cold-start-resilience.md), [082](docs/decisions/082-pwa-update-auto-recover.md)): inline boot shell in [`app.html`](src/app.html) (`[data-ppp-boot]` removed on layout mount); [`hooks.client.ts`](src/hooks.client.ts) + [`client-recovery.ts`](src/lib/pwa/client-recovery.ts) auto clear-cache+reload on chunk-load failure (manual card only if that already failed within 20s); 12s nav watchdog in root layout.
- **Error boundary** — [src/routes/+error.svelte](src/routes/+error.svelte): branded, status-aware (404/403/401/500) full-page error with a "Go to dashboard" link. First error boundary in the repo ([053](docs/decisions/053-ux-safety.md)); extend it rather than falling back to the default SvelteKit page.
- **Graceful owner/permission gate** — return `{ notOwner: true, … }` from `load` and render an inline "Owner-only" card, **not** `error(403)`. Keeps page chrome and gives a friendly message. Canonical example: `/settings/permissions` ([053](docs/decisions/053-ux-safety.md)).
- **Confirm-gated destructive triggers** — the trigger button is de-emphasized (`variant="outline"` + `text-destructive`, no `hotkey`); the `<ConfirmDialog>` carries `hotkey="d"`. Drive a hidden action form via `requestSubmit()`. See book delete + scripture/topic deletes on `/library/books/[id]` and the settings pattern (`/settings/library/series`).
- **Auth** — `src/lib/server/auth-session.ts`: `resolveSessionUser()` via `auth.getClaims()` (local JWKS when asymmetric JWT keys enabled); returns narrow `SessionUser` (`id`, `email`). Memoized per request in `hooks.server.ts` as `locals.safeGetSession`. Security headers (CSP, X-Frame-Options, etc.) applied in the same handle. See [052](docs/decisions/052-security-hardening.md).
- **Performance budgets** — [.cursor/rules/performance.mdc](.cursor/rules/performance.mdc). Server-paginated list loaders (`loadBookListFiltered` → `{ books, filteredCount }`); book-detail secondary data streamed or lazy JSON (`/library/topic-counts.json`, `/library/ancient-texts.json`); per-request `safeGetSession` memo in `hooks.server.ts`; `Server-Timing: total` on every response; scoped `invalidate('app:library:…')` keys; signed-URL TTL 24h + `signStorageUrlsLimited`. Decision log: [033](docs/decisions/033-performance-pass.md).
- **Library helpers** at `src/lib/library/`:
  - `src/lib/types/library.ts` — closed enums (`GENRES`, `LANGUAGES`, `READING_STATUSES`, `AUTHOR_ROLES`) + view-models (`BookListRow`, `BookDetail`, `PersonRow`, `ScriptureRefRow`, etc.). Reuse before improvising.
  - `src/lib/library/polymorphic.ts` — `PolymorphicParent` discriminated union + `validateXor` + `insertPolymorphicRow<T>`. Reused by `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`. **Do not invent four versions** per [.cursor/rules/library-module.mdc](.cursor/rules/library-module.mdc).
  - `src/lib/library/storage.ts` — `SCRIPTURE_IMAGES_BUCKET`, `SCRIPTURE_IMAGES_SIGNED_URL_TTL`, `scriptureImagePath({ userId, bookId, ext })`. Single source of truth for the `library-scripture-images` bucket name + path convention; imported from both server (signed-URL generation in loaders) and browser (upload in form components).
  - `src/lib/library/server/loaders.ts` — `loadBookListFiltered` (server-paginated list + `{ filteredCount }`), `loadEssaySearchHits` (keyword `q` → essay title / essay-author hits, cap 20 — [086](docs/decisions/086-essay-visibility-and-search-lanes.md)), `loadBookDetail`, `loadSeries`, `loadPublishers`, `loadPublisherBookCounts`, `loadPeople`, `loadPersonBookCounts`, `loadBibleBookNames`, `loadScriptureRefsForBook` (signed URLs via `signStorageUrlsLimited`), `loadScriptureRefsNeedingReview`, `loadEssaysForBook` (essay + `essay_authors` → `EssayRow`), `personDisplayShort/Long`, `loadBookFormPageData`, `countLiveBooks` / `countBooksNeedingReview`. Used by `/library` and `/library/books/[id]`. Book selects embed publishers via `PUBLISHER_EMBED` (`publishers!books_publisher_id_fkey`) — required after `reprint_publisher_id` FK; unqualified `publishers (...)` returns PGRST201 and loaders silently empty (see [037](docs/decisions/037-publishers-embed-disambiguation.md)).
  - `src/lib/library/publisher-resolve.ts` — `publisherEffectiveLocation`, `publisherCanonicalText` (book override → imprint `default_location` → parent default).
  - `src/lib/library/server/publishers-settings-actions.ts` — `/settings/library/publishers` CRUD + `mergePublishersSettingsAction` (RPC `library_merge_publishers`).
  - `src/lib/library/sign-storage-urls.ts` — `signStorageUrlsLimited` (bounded parallel Storage signing).
  - `src/lib/library/scripture-ref-format.ts` — `formatScriptureRefRangeDisplay`, `formatScriptureRefPageSummary` (shared scripture labels; audit-log entity label pattern).
  - `src/lib/library/isbn.ts` — `normalizeIsbnDigits`, `parseIsbnWithChecksum` (ISBN-10/13 check digit); used by `/library/add`, `fetchOpenLibraryPrefill`, manual OL entry.
  - `src/lib/library/vocab-cache-paths.ts` — `LIBRARY_VOCAB_CACHE_PATHS` + named exports; single source of truth for SW SWR allowlist and client fetches of people/series/topic-counts/ancient-texts JSON.
  - `src/lib/library/camera-stream.ts` — `acquireCameraStream`, `scheduleReleaseCameraStream`, `releaseCameraStreamNow`: module-scoped warm `MediaStream` for `/library/add` + `<BookOlRefreshDialog>` so iOS standalone PWA avoids re-prompting every remount; releases on idle (~15s default), visibility hidden, or explicit stop.
  - `src/lib/library/publisher-location.ts` — `normalizePublisherLocationTurabian` (US `City, ST`, well-known cities alone, strip `USA`; OL prefill + research proposals + review-card proposal filter).
  - `src/lib/library/proposal-filter.ts` — `filterProposalForBook`, `hasVisibleProposalFields` (drop redundant proposal diffs against live book state).
  - `src/lib/library/open-library-prefill.ts` — re-exports `normalizeIsbnDigits` from `isbn.ts`; `fetchOpenLibraryPrefill` (checksum-validated ISBN, edition + optional OL work + up to 5 author JSON fetches; `authors[]`, `authorTyped`, `publisher` / `publisher_id` via `matchPublisher`, `publisher_location` Turabian-normalized, `edition`, `genreSuggested`, `seriesName` / `seriesVolume`, `languageCode`); `LIBRARY_OL_PREFILL_KEY` (`library_ol_prefill_v2`) for `/library/add` → `/library/books/new` prefill.
  - `src/lib/library/match.ts` — `matchPersonExact`, `matchPersonFuzzyCandidates`, `matchSeries`, `splitAuthorString`, `normalizePersonName` / `normalizeSeriesName` for ISBN prefill consumption in `<BookForm>`.
  - `src/lib/library/fuzzy.ts` — `similarityApprox`, `bestSimilar` (generic fuzzy scoring under `match.ts` / typo warnings).
  - `src/lib/library/person-search.ts` — `personSearchKey/Tokens`, `scorePersonMatch`, `filterPeople` (person autocomplete ranking).
  - `src/lib/library/authors-label.ts` — `authorsLabelForBook` display labels; unit tests in `__tests__/`.
  - `src/lib/library/title-sort.ts` — `titleSortKey` (language-aware leading-article strip), importer match-key helper.
  - `src/lib/library/bible-book-names.ts` — static `BIBLE_BOOK_NAMES` vocab (perf rule: do not query `bible_books` per navigation).
  - `src/lib/library/review.ts` — `parseReviewFilters` (incl. deck params `missing`/`shelf`/`proposal`/`isbn`/`shuffle`), `withReviewShelfDefault` (away-from-shelf default), `SHELF_CHECK_MARKER`, `ensureShelfMarkerNote` / `SHELF_DEFER_LINE`, `editionHintFromNote` ([076](docs/decisions/076-review-edition-action-bar.md)), slice/deck query filters for `/library/review` ([067](docs/decisions/067-library-review-sprint-decks.md), [074](docs/decisions/074-review-tab-corrections.md)).
 - `src/lib/library/review-decks.ts` — `REVIEW_DECKS` (Citation Critical / Genre Sprint / Research / Puzzles / Backlog / Needs the shelf), `hasReviewDeckParams`, `sliceForReviewFilters`, `isReviewDeckActive`, `reviewDeckSearchParams`, `REVIEW_TOP_GENRES`. Client-safe; drives `<ReviewDeckPicker>` + page-server deck counts ([067](docs/decisions/067-library-review-sprint-decks.md)).
 - `src/lib/library/list-filter-genres.ts` — `LIBRARY_FILTER_TOP_GENRES` + `primaryFilterGenres` / `overflowFilterGenres` for compact `/library` genre chips ([086](docs/decisions/086-essay-visibility-and-search-lanes.md)).
 - `loadEssaySearchHits` in `src/lib/library/server/loaders.ts` — parallel essay title + essay-author last-name hits for `/library` keyword `q` (cap 20; does not touch `books.search_vector`) ([086](docs/decisions/086-essay-visibility-and-search-lanes.md)).
 - `src/lib/library/turabian/review-progress.ts` — localStorage burndown + **sprints** (`startSprint`/`recordSprintClear`/`recordSprintSkip`/`recordSprintUnclear`/`endSprint`/`isSprintComplete`, key `library.review.sprint`) + **milestones** (`milestoneKeysFor`/`milestoneLabel`/shown-set, key `library.review.milestones`); `decrementReviewProgress` for Confirm undo ([071](docs/decisions/071-review-queue-authorless-undo.md)); unit tests `turabian/__tests__/review-progress.test.ts` ([067](docs/decisions/067-library-review-sprint-decks.md)).
 - `src/lib/library/server/proposal-actions.ts` — `resolveProposalAction` + `markProposalResolved` + `markProposalPending` (undo) for `book_metadata_proposals` (AI research pass [068](docs/decisions/068-library-review-ai-research-pass.md)); accept path rides `reviewSaveAction` (`proposal_id` + `proposal_resolution` FormData fields). Proposals never clear `needs_review` by themselves.
  - `src/lib/library/ocr-scripture-refs.ts` — OCR candidate/response types shared by client + batch form (distinct from `ocr-invoke-client.ts`).
  - `src/lib/library/server/coverage-actions.ts` — bible/ancient coverage create + soft-delete actions, inline `ancient_texts` create.
  - `src/lib/library/server/topic-actions.ts` — `book_topics` CRUD + `parseBookTopicForm` (batch-capable).
  - `src/lib/library/server/essay-actions.ts` — `essays` + `essay_authors` CRUD (`createEssayAction`, `updateEssayAction`, `softDeleteEssayAction`); `parseEssayForm` + diff-based `syncEssayAuthors`. Used by `/library/books/[id]` essays section (Wave 2 Session 2).
  - `src/lib/library/server/people-actions.ts` — `findOrCreatePerson`, `parseTypedName`, B14 dedup helpers (`b14BucketKey`, `b14PairMayBeDuplicate`).
  - `src/lib/library/server/books-csv.ts` — TSV/CSV export + import headers, row caps, delete-on-import notes (`/settings/library/export`).
  - `src/lib/library/server/url-params.ts` — `parseBookListFilters` / `bookListFiltersToSearchParams` (URL is source of truth for `/library` filters).
  - `src/lib/library/server/publishers-settings-book-counts.ts` — `fetchLiveBookIdsByPublisherId` for publisher settings counts.
  - `src/lib/library/book-copy-text.ts` — plain-text strings for book-detail clipboard helpers (Session 6 raw-field copy; coexists with Turabian).
  - `src/lib/library/review-swipe.ts` — touch swipe on `/library/review` card (right = Confirm via `requestSubmit`, left = Skip); pointer capture, interactive-target bail.
  - `src/lib/library/turabian/` — pure-function Turabian 9th-ed. formatters (`formatFootnote` + `shortForm` `ibid`/`short`, `formatBibliography`, `formatCompiledBibliography`, `formatEssayFootnote` / `formatEssayBibliography` — unsigned `s.v.`, signed dictionary, TDNT abbreviated, chapter-in-edited-volume dispatch; `copyCitationToClipboard`, `CITATION_CRITICAL_GENRES`, `review-progress.ts` localStorage burndown). QA fixtures: [docs/library-turabian-fixtures.md](docs/library-turabian-fixtures.md) + `WAVE2_FIXTURES` in `__tests__/fixtures.ts`. Structured names via `BookAuthorAssignment` + `parseAuthorAssignment`. `joinNoteSegments` / `joinBibSegments` per Covenant §17.1; `work_type` on `BookCitationInput`. Powers book-detail Copy Footnote/Bibliography, `/library/bibliography`, and Turabian-first `/library/review` cards. Unit tests: `npm run test`. **`.docx` export ([063](docs/decisions/063-library-wave2-session4-docx-export.md)):** `formatBibliographyEntries` (sorted non-empty entries, shared with clipboard compile) + `html-segments.ts` (`parseCitationHtmlSegments` — `CitationFormatted.html` → italic/plain runs; client-safe) feed `src/lib/library/server/bibliography-docx.ts` (`buildBibliographyDocx`, `docx` package — **server-only, not exported from the turabian barrel** so `docx` stays out of client bundles) behind `GET /library/bibliography/download?ids=` (attachment, US Letter, 0.5" hanging indent, TNR 12pt).
  - `WORK_TYPES` / `WORK_TYPE_LABELS` in `src/lib/types/library.ts` — `monograph` | `edited_volume` | `reference_work` on `books.work_type` (Turabian dispatch + review missing-field rules). Book form + OL prefill (`workTypeSuggested` for dictionaries).
  - `src/lib/library/server/book-actions.ts` — `createBookAction`, `updateBookAction`, `softDeleteBookAction`, `undoSoftDeleteBookAction`, `reviewSaveAction`, `undoReviewSaveAction` ([071](docs/decisions/071-review-queue-authorless-undo.md)), `markNeedsShelfAction` ([074](docs/decisions/074-review-tab-corrections.md)), `createPersonAction`, `updateReadingStatusAction`. Returns `{ kind, success?, message?, bookId?|personId? }`.
  - `src/lib/library/server/people-settings-actions.ts` — `updatePersonSettingsAction`, `softDeletePersonSettingsAction`, `mergePeopleSettingsAction` (merge calls RPC `library_merge_people`, owner-only). Used by `/settings/library/people` and `/settings/library/people/merge`. Exports `loadProfileRole` for reuse.
  - `src/lib/library/server/people-settings-book-counts.ts` — `fetchLiveBookIdsByPersonId` (chunked `book_authors` + live `books` join) for People + Merge settings counts.
  - `src/lib/library/server/series-settings-actions.ts` / `series-settings-book-counts.ts` — `/settings/library/series` update + guarded soft-delete.
  - `src/lib/library/server/ancient-texts-settings-actions.ts` / `ancient-texts-settings-book-counts.ts` — `/settings/library/ancient-texts` CRUD + `mergeAncientTextsSettingsAction` (RPC `library_merge_ancient_texts`, owner-only).
  - `src/lib/library/server/permissions-actions.ts` — `upsertUserPermissionAction` for `/settings/permissions` (owner-only).
  - `src/lib/library/server/scripture-actions.ts` — same shape for `scripture_references`: `createScriptureRefAction`, `createScriptureRefsBatchAction`, `updateScriptureRefAction`, `softDeleteScriptureRefAction`. Wired into `/library/books/[id]` Session 2.
  - `src/lib/library/ocr-invoke-client.ts` — `getPdfPageCount`, `invokeOcrScriptureRefs` (+ optional `pdf_page_index`), Edge error parsing; batch form uploads PDF once then OCRs pages via **client rasterize** ([`pdf-page-render.ts`](src/lib/library/pdf-page-render.ts): `pdfjs-dist` dynamic import → JPEG → `image/jpeg` Edge) with original PDF as `source_image_url`; partial batch + retry failed pages ([030](docs/decisions/030-ocr-pdf-input.md)).
  - `src/lib/library/pdf-page-render.ts` — `getPdfPageCountFromFile`, `renderPdfPageToJpegBlob` (~2048px JPEG); loaded only when user queues a PDF for OCR.
 - `src/lib/library/scripture-batch-upload.ts` — `buildRowsJsonPayload`, `collapseRowsAfterMerge`, `computeRowWindow`, `chunkArray` (batch OCR perf; see [034](docs/decisions/034-scripture-batch-upload-perf.md)).
 - `src/lib/library/scripture-batch-draft.ts` — `loadScriptureBatchDraft` / `saveScriptureBatchDraft` / `clearScriptureBatchDraft` (sessionStorage resume for batch scripture form).
 - `src/lib/library/scripture-draft-row.ts` — `ScriptureDraftRow` / `ScripturePageJob` types, `blankDraftRow`, `draftRowFromExisting`, strip label helpers; shared by `<ScriptureReferenceForm>` shell + row editor + OCR queue ([062](docs/decisions/062-library-wave2-session3-megacomponent-split.md)).
 - `src/lib/library/scripture-ocr-merge.ts` — `mergeJobsIntoRows`, `finalizeOcrMerge`, PDF page stamp helpers for OCR pipeline.
 - `src/lib/library/book-form-ol.ts` — `applyOlPrefillFields`, `applyOlRefreshPatch`, `buildOlAuthorRows` for `<BookForm>` OL prefill/refresh; unit tests `book-form-ol.test.ts`.
 - `src/lib/library/run-with-concurrency.ts` — `runWithConcurrency` (OCR file pipeline cap).
  - **`supabase/functions/ocr_scripture_refs`** — Library OCR: user JWT via `/auth/v1/user`, service-role storage download from `library-scripture-images`, Anthropic Messages API (vision + PDF `document` block). Secrets: `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_OCR_MODEL`); see [supabase/README.md](supabase/README.md) + [021](docs/decisions/021-library-session-9-ocr-anthropic-wired.md). Dense index pages: `max_tokens` 64k + short `rawText` prompt; `stop_reason=max_tokens` → HTTP 422 — [026](docs/decisions/026-ocr-density-truncation.md). Post-OCR batch review: compact rows, page-boundary markers, bulk confirm, contiguous page-range prompt — [028](docs/decisions/028-ocr-review-ux-and-accuracy.md). Patristic semicolon section pointers (`VI, 7; VIII, 10`) → one row per pointer — [029](docs/decisions/029-ocr-section-pointer-split.md). Multi-page PDF input (one call per file; `source_page_index` for strip grouping) — [030](docs/decisions/030-ocr-pdf-input.md); bucket allows `application/pdf` up to 25 MiB.

- **Projects helpers** at `src/lib/projects/` (schema: [docs/POS_Schema_v1.md](docs/POS_Schema_v1.md#projects), migrations `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`, `20260604100000_project_updates_progress.sql`, `20260709164016_projects_email_inbox_and_domain_colors.sql`; MYN design: [docs/MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md)):
  - `src/lib/types/projects.ts` — lifecycle/health enums; MYN `TASK_PRIORITIES`, `TASK_ZONE_CAPS`, `ProjectTaskView` (incl. `notes`), `TaskZoneGroup`, `ProjectLinkRow`; `ProjectRow.color`.
  - `src/lib/projects/week.ts` — civil **Chicago Sunday** week start; unit tests: `week.test.ts`.
  - `src/lib/projects/filter.ts` — URL filters, attention set, trend direction; unit tests: `filter.test.ts`.
  - `src/lib/projects/progress.ts` — check-in progress `formatProgressLabel` / `progressPercent` / parsers ([048](docs/decisions/048-projects-checkin-progress.md)); unit tests: `progress.test.ts`.
  - `src/lib/projects/carry-forward.ts` — copies check-in fields (incl. progress) from most recent prior week; unit tests: `carry-forward.test.ts`.
  - `src/lib/projects/health-appearance.ts` — Epic palette tokens (`HEALTH_HEX`, segment/lifecycle classes) ([047b](docs/decisions/047-projects-status-appearance.md)).
  - `src/lib/projects/project-colors.ts` — curated domain color palette keys + static Tailwind DOT/RAIL/ROW_TINT class maps ([077](docs/decisions/077-email-to-task-and-domain-colors.md)).
  - `src/lib/projects/email-inbound.ts` — Resend inbound helpers (subject clean, allowlist, HTML→text); unit tests: `email-inbound.test.ts` ([077](docs/decisions/077-email-to-task-and-domain-colors.md)).
  - `src/lib/projects/server/loaders.ts` — tree, week updates, carry-forward, `loadLatestHealth`.
  - `src/lib/projects/server/task-loaders.ts` — `loadTasks` (zoned MYN + FRESH), `loadLinksByProject`.
  - `src/lib/projects/server/actions.ts` — check-in + project CRUD + `setProjectColorAction` + `project_links` CRUD/reorder.
  - `src/lib/projects/server/task-actions.ts` — MYN task create/update/complete/defer/promote/soft-delete (incl. `notes`).
  - `/projects` — tree + metadata sheet (links in edit mode) + domain color picker; `depends('app:projects:tree')`.
  - `/tasks` — MYN task page (legacy `/projects/tasks` 308-redirects here); `depends('app:projects:tasks')`; Chicago today via `ymdInChicago()`.
  - **Email → task:** Edge Function `email-inbound-task` (Resend inbound → Email Inbox project); secrets `RESEND_WEBHOOK_SECRET`, `INBOUND_TASK_PROJECT_ID`, `INBOUND_TASK_ALLOWED_SENDERS` — [supabase/README.md](supabase/README.md).
  - **Partial unique upsert:** `project_updates` — PK `id` only ([045](docs/decisions/045-projects-session-1-tree-checkin.md)).
  - **Audit log:** `_PROJECTS_TABLES` includes `project_tasks`; soft-delete revert for `projects`, `project_updates`, `project_tasks`.

### Scripts

- **Supabase workflow:** one hosted project. Do **not** use `supabase start` or a local Docker stack for this repo; apply migrations with `npm run supabase:db:push` to the linked project. See [supabase/README.md](supabase/README.md).
- `npm run check` — svelte-check
- **`PPP_BUNDLE_VIZ=1 npm run build`** — client treemap at `.bundle-viz/treemap.html` (gitignored; `rollup-plugin-visualizer` in [vite.config.ts](vite.config.ts)). See [docs/decisions/025-library-bundle-split.md](docs/decisions/025-library-bundle-split.md).
- `npm run supabase:db:push:dry` — review migration diff before applying
- `npm run supabase:db:push` — apply migrations to prod
- `npm run supabase:gen-types` — regenerate `src/lib/types/database.ts` (run after every migration)
- `npm run supabase:deploy-functions` — deploy Edge Functions
- `npm run supabase:ship` / `:ship:apply` — combined flow
- **`npm run test:rls`** / **`test:rls:ensure-users`** — library RLS matrix on **ppp-staging** only ([scripts/rls-smoke/README.md](scripts/rls-smoke/README.md))
- **`npm run test:perf`** — optional `Server-Timing` budgets on `/library`, `/library?q=…`, `/dashboard` ([scripts/perf-smoke/README.md](scripts/perf-smoke/README.md); needs running dev server + `PERF_SMOKE_*` or `RLS_TEST_OWNER_*`)
- **`npm run supabase:db:push:staging`** — apply migrations to ppp-staging
- **`npm run ship-library`** / **`ship-library:apply`** — library schema gate: `check` → `db:push:dry` (or full push + `gen-types` + `test` + `deploy-functions` on apply). Use after any library migration or OCR Edge change.
- **`library:language-audit`** — dry-run / optional `--apply` English→German hints; uses `LIBRARY_AUDIT_DATABASE_URL` or **`LIBRARY_DST_DATABASE_URL`** / `LIBRARY_SRC_DATABASE_URL` (same migrate vars). See [`scripts/library-language-audit/README.md`](scripts/library-language-audit/README.md).
- **`library:review-research`** — AI research pass ([068](docs/decisions/068-library-review-ai-research-pass.md)): OL + optional Anthropic genre proposals into `book_metadata_proposals` (pending; owner confirms on `/library/review`). Dry-run default; `LIBRARY_RESEARCH_CONFIRM=yes … --apply`. IPv4 networks need the **Session Pooler** URI (`LIBRARY_RESEARCH_DATABASE_URL`; derive via `scripts/backup-restore-verify/derive-pooler-url.ts`) — the Direct host is IPv6-only. See [`scripts/library-review-research/README.md`](scripts/library-review-research/README.md).

## Commit messages (library)

Prefer: `library: <decision-slug> — <outcome>` (e.g. `library: 038-client-perf — collapse-by-default batch rows`). Makes `git log` bisectable alongside `docs/decisions/`. Numbers 004/005/033/047 are ambiguous (collisions — see [docs/decisions/README.md](docs/decisions/README.md)); include enough slug to disambiguate.

## Large diffs

Any commit touching **>400 LOC** — any module, not just library — should get a **read-only review subagent** pass before push (mobile + RLS + citation regressions). Diffs touching RLS policies, Edge Functions, auth, or storage policies get a **security-review subagent** pass regardless of size. Full routing table: [.cursor/rules/workflow.mdc](.cursor/rules/workflow.mdc).

## Environment variables

Two files. Both are gitignored.

| File | Purpose | Examples |
|---|---|---|
| `.env` | Prod project ref / non-secret config used by CLI scripts — copy from [`.env.example`](.env.example) | `SUPABASE_REF` |
| `.env.local` | Prod secrets and public client config | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, **`ANTHROPIC_API_KEY`** (optional — mirror of Supabase Edge secret for `supabase functions serve` / local OCR dev only), **`LIBRARY_SRC_DATABASE_URL`**, **`LIBRARY_DST_DATABASE_URL`**, **`LIBRARY_MIGRATE_CONFIRM`** (Postgres URIs, typically both from Supabase Dashboard **Connect → Direct** — see [`scripts/library-migrate-local-to-prod/README.md`](scripts/library-migrate-local-to-prod/README.md)) |
| `.env.staging` | **ppp-staging** ref only | `SUPABASE_REF` — copy from [`.env.staging.example`](.env.staging.example) |
| `.env.staging.local` | Staging keys + RLS test passwords | `PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RLS_TEST_*` — see [`scripts/rls-smoke/README.md`](scripts/rls-smoke/README.md) |

**GitHub Actions secrets** (repo Settings → Secrets; never in `.env` — see [055](docs/decisions/055-ci-backups.md)):

| Secret | Purpose |
|---|---|
| `BACKUP_DATABASE_URL` | Prod **Session Pooler** URI for weekly `pg_dump` (IPv4-safe on GitHub runners) |
| `R2_ENDPOINT` | Cloudflare R2 S3 API endpoint |
| `R2_BUCKET` | Private R2 bucket for weekly dumps |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |

Setup commands: [`scripts/backup-restore-verify/README.md`](scripts/backup-restore-verify/README.md).

Rules:

- Anything prefixed `PUBLIC_` is exposed to the client — only safe-to-publish values (URL, anon key).
- Edge Function secrets live in Supabase: `supabase secrets set NAME=value`. They are **not** read from `.env.local` at runtime — duplicate them in both places (.env.local for local dev, Supabase secrets for prod).
- When you add an env var, document it in the relevant decision-log entry.

## Decision log — `docs/decisions/`

One file per build session. Filed at session end. This is the input to the *next* session's Session 0 audit.

Naming: `NNN-short-slug.md` (`001-app-shell.md`, `002-time-entries.md`, ...).

### Template

```md
# NNN — <session title>

**Date:** YYYY-MM-DD
**Module:** invoicing | library | projects | ...
**Tracker session:** Session N

## Built
- <bullet — what shipped>

## Decided
- <bullet — non-obvious decision and the alternative rejected>

## Schema changes
- <migration filename + one-line summary>

## New components / patterns added
- <path — purpose. Update components.mdc if reusable.>

## Open questions surfaced
- <question — owner — when it must be resolved>

## Surprises (read these before the next session)
- <bullet — anything that bit you>

## Carry-forward updates
- [ ] components.mdc updated
- [ ] AGENTS.md inventory updated
- [ ] new env vars documented
- [ ] tracker Open Questions updated
```

## Pre-commit safety net

A Cursor hook in `.cursor/hooks.json` warns when a migration is changed without regenerating `src/lib/types/database.ts`. If you see that warning, run `npm run supabase:gen-types` and include the result in the same commit.
