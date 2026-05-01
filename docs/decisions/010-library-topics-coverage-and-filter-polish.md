# 010 — Library Session 5: Topics + Coverage + Filter Polish

**Date:** 2026-04-30
**Module:** library
**Tracker session:** Session 5

## Built

- `<CanonicalizingCombobox>` — shared typeahead for `ancient_texts` (with
  owner-only inline create) and `book_topics.topic` (with typo warning).
  Mirrors `<PersonAutocomplete>`'s chip + search mode split. Lives at
  [src/lib/components/canonicalizing-combobox.svelte](../../src/lib/components/canonicalizing-combobox.svelte).
- `<MultiCombobox>` — multi-select typeahead facet used for the `/library`
  Series + Author filters. Chips above an input, keywords-aware substring
  filter, no create path. Lives at
  [src/lib/components/multi-combobox.svelte](../../src/lib/components/multi-combobox.svelte).
- `src/lib/library/fuzzy.ts` — client-side trigram Jaccard
  (`similarityApprox`, `bestSimilar`) approximating `pg_trgm`'s
  `similarity()` to within ~0.02 on short strings. Drives the topic
  typo-warn gate (threshold 0.7, gated to existing-topic count < 3).
- Three new junction entry surfaces on `/library/books/[id]`, all wrapping
  the Session 2 `<SourcePicker lockedBookId>` (zero new polymorphic code —
  grep-verified):
  - `<BookTopicForm>` — batch-capable clone of `<ScriptureReferenceForm>`.
    Shared page image, N rows, `rows_json` → `?/createBookTopicsBatch`.
    Edit mode is the degenerate single-row.
  - `<BookBibleCoverageEditor>` — 66-chip toggle grid. Each toggle posts
    `?/createBibleCoverage` or `?/softDeleteBibleCoverage`.
  - `<BookAncientCoverageEditor>` — combobox picker + chip list. Owner-only
    inline `ancient_texts` create via a dialog fed by the combobox
    `onCreate` callback (defense-in-depth owner gate on the
    `?/createAncientText` action itself, alongside the baseline
    `ancient_texts_owner_insert` RLS policy).
- New server-side helpers:
  - [`src/lib/library/server/topic-actions.ts`](../../src/lib/library/server/topic-actions.ts) —
    parser, `createBookTopicsBatchAction`, `updateBookTopicAction`,
    `softDeleteBookTopicAction`. Canonicalizes `topic` to `lower(trim(…))`
    at the parser so the schema CHECK never fires a user-visible error.
  - [`src/lib/library/server/coverage-actions.ts`](../../src/lib/library/server/coverage-actions.ts) —
    `createBibleCoverageAction`, `softDeleteBibleCoverageAction`,
    `createAncientCoverageAction`, `softDeleteAncientCoverageAction`,
    `createAncientTextAction`. Coverage junctions have no `deleted_at` →
    hard DELETE; idempotent re-adds via UNIQUE(book_id, bible_book) on the
    Bible side and an app-layer pre-check on the ancient side.
- New loaders in
  [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts):
  `loadAncientTexts`, `loadBookTopicsForBook` (signs image URLs like
  `loadScriptureRefsForBook`), `loadBibleCoverageForBook`,
  `loadAncientCoverageForBook`, `loadAllTopicCounts`.
- `/library/search-passage` extended to merge
  `search_scripture_refs()` hits with `book_bible_coverage` hits in the
  same parent `load`. Coverage rows get `source_kind: 'coverage'`, dedupe
  against ref hits on `book_id`, render a sky "Coverage" badge.
- `/library` filter polish:
  - Series chip rail → `<MultiCombobox>` searchable by name OR abbreviation.
  - New Author multi-select facet against the 911-person `loadPeople` set.
    Server resolves `author_id` via parallel `book_authors.person_id IN (…)`
    → `book_ids` and narrows with `.in('id', bookIds)`.
  - Category facet removed from the filter UI (desktop aside + mobile
    sheet + active-filter chip rail). `books.primary_category_id` column
    and the book-form input remain for shelving.

## Decided

- **Topic typo warning: client-side trigram Jaccard, not a new
  SECURITY INVOKER RPC.** Rationale: topics are browser-scale (0 → low
  thousands long-term), the 911-person loader already proves client-side
  matching works at scale, and the "all schema is in place" session goal
  preserved. Alternative rejected: a small `topic_similarity(p_new TEXT)`
  RPC returning `(topic, similarity, count)` rows above the 0.7 threshold.
  That's still the correct upgrade path if false negatives start slipping
  through (rare typos the JS approximation misses that `pg_trgm` would
  catch). The `<CanonicalizingCombobox>` contract accepts
  `fuzzyWarn: (raw) => { suggestion, count } | null` — async-compatible,
  so the swap is surface-only.
- **Passage search extension: app-layer parallel SELECT, not a new SQL
  UNION.** Rationale: keeps the session migration-free, holds the SQL
  function stable for the trip period, and the merge logic is small. The
  promotion bar is "a second module needs coverage-aware search" — at
  that point absorb it into a `search_passage_with_coverage()` function
  that replaces `search_scripture_refs()` in callers.
- **Author facet resolve via `id.in.(…)` with 200-id slice fallback
  (decision 009 Surprise #1).** If the resolved book-id list exceeds
  `MAX_IN_LIST = 200`, the loader fetches without the author narrow and
  prunes client-side after hydration. The post-hydration filter is cheap
  at prod scale (~1,331 rows) and the header-cap edge case stays out of
  users' way.
- **Category facet dropped (Open Question 11 resolved).** Post-Pass-1,
  `SUBJECT_TO_GENRE` + `GENRE_TO_CATEGORY_SLUG` make `primary_category_id`
  fully derivable from `genre`, so the facet duplicated Genre. The
  column stays — shelving still uses it and a future divergence (a
  Pastoral commentary shelved under Pastoral specifically) re-introduces
  real signal. Revisit when ≥10 books have a `primary_category_id` that
  differs from the default mapping.
- **Topic form is batch-mode (matching scripture refs).** Same shape
  carries forward to OCR-driven topic ingest in Session 9; keeping the
  two entry surfaces structurally identical means the OCR button lands
  in the same place on both forms.

## Schema changes

_None — all four junction tables + `ancient_texts` were already in the
baseline. The "all schema is in place" session goal held._

## New components / patterns added

- [src/lib/components/canonicalizing-combobox.svelte](../../src/lib/components/canonicalizing-combobox.svelte) —
  canonical-name + abbreviations typeahead with optional `onCreate` +
  `fuzzyWarn` hooks. Registered in components.mdc.
- [src/lib/components/multi-combobox.svelte](../../src/lib/components/multi-combobox.svelte) —
  generic multi-select facet picker. Registered in components.mdc.
- [src/lib/components/book-topic-form.svelte](../../src/lib/components/book-topic-form.svelte) —
  batch topic entry form. Registered.
- [src/lib/components/book-bible-coverage-editor.svelte](../../src/lib/components/book-bible-coverage-editor.svelte),
  [src/lib/components/book-ancient-coverage-editor.svelte](../../src/lib/components/book-ancient-coverage-editor.svelte) —
  per-junction editors wrapping `<SourcePicker>`. Registered.
- [src/lib/library/fuzzy.ts](../../src/lib/library/fuzzy.ts) — trigram
  Jaccard helper. `pg_trgm` is still the server-side gold standard when
  exact semantics matter (e.g. cross-device reproducibility for audit).
- **Client-side trigram fuzzy-match pattern** — mirrors the server-side
  Session 3 trigram indexes. Use when a fuzzy warn / dedup hint can live
  in the browser against an already-loaded dataset; promote to a pg_trgm
  RPC when the set outgrows the browser or semantics need to be exact.

## Open questions surfaced

- None new. The topic-similarity upgrade path (pg_trgm RPC) is documented
  above but isn't blocking anything — waiting on real-world evidence of
  false negatives.

## Surprises

- **`MultiCombobox` + URL-as-source-of-truth needs local `$state` mirrors.**
  `<MultiCombobox>` takes `values = $bindable<string[]>()`. If we bind
  directly to `filters.series_id`, Svelte 5 treats the `$derived` filters
  snapshot as read-only and mutations fall on the floor. The fix was to
  keep `filters = $derived(data.filters)` as the source of truth, but mirror
  the two facet arrays into local `$state` that re-hydrate from `filters.*`
  inside an `$effect`, AND expose an `onChange` callback on the combobox
  that pushes the new array into the URL via `setArrayFilter(…)`. This
  pattern generalizes to any bindable facet component driven by URL state —
  worth codifying in library-module.mdc if another surface needs it.
- **Book-topics batch insert needs the parent stub trick.** The existing
  batch parser in `scripture-actions.ts` synthesizes a dummy parent in each
  per-row `rawToFormData` because `parseScriptureRefForm` re-validates
  parent per row. Copied the same shape into `topic-actions.ts`; future
  polymorphic batch parsers should share an extracted helper, but not
  before Session 5.5's "premature extraction" bite.
- **Ancient-text inline-create + auto-link flow.** After
  `?/createAncientText` succeeds, the dialog is closed AND the newly
  minted row is immediately linked to the current book via a follow-up
  `?/createAncientCoverage`. Two round-trips on create feels right — the
  RLS model keeps them as distinct concerns, and the UI state stays
  simple.

## Carry-forward updates

- [x] components.mdc updated with all five new components.
- [x] AGENTS.md inventory: `<CanonicalizingCombobox>`, `<MultiCombobox>`,
      and the three book-detail editors are registered in components.mdc
      which is the canonical inventory. No AGENTS.md-only entries needed.
- [x] No new env vars.
- [x] Open Question 11 marked RESOLVED in the tracker.
- [ ] library-module.mdc update for the "URL-as-source-of-truth +
      `<MultiCombobox>` mirror" pattern — defer until a second surface
      needs it; call it out here so the next author finds it.
