# 009 — Library review-queue UI (Session 5.5)

**Date:** 2026-04-30
**Module:** library
**Tracker session:** Session 5.5

## Built

- **`/library/review`** — mobile-first card-stack surface for draining the
  1,169 `needs_review = true` queue from a phone. One card on screen at a
  time, hotkeys (`Cmd+S` save, `Esc` skip, `Cmd+D` delete), pre-fetched
  10-card local stack with refill via `/library/review/queue` JSON endpoint
  when the stack drops below 3.
- **Per-card quick-edit fields**: only the citation-critical inputs that drive
  the `Missing: …` auto-line render — `title`, `year`, `publisher` show as
  text inputs only when the underlying field is null. `genre`, `language`,
  `reading_status` always render as chip rows. `Edit full` links to
  `/library/books/[id]/edit` for the cards that need more.
- **Slice pill rail** — `All` · `No subject` (genre IS NULL — the 1,047 chunk)
  · `No OL match` · `Title-only OL`. URL-as-source-of-truth pattern from
  Session 3 (`?subject=blank`, `?match_type=no-match`). Other URL params
  (`?genre=`, `?language=`, …) compose with the slice.
- **`reviewSaveAction`** in `src/lib/library/server/book-actions.ts` — focused
  partial-overlay UPDATE that **always** flips `needs_review = false` and
  strips the `Missing: …` auto-line (via the new `stripReviewAutoLine` helper
  exported alongside `mergeReviewNote`).
- **`loadReviewQueue` + `countReviewQueue`** in
  `src/lib/library/server/loaders.ts` — paginated, filter-aware, exclude-list-
  aware. Returns the new `ReviewCard` view-model.
- **`books.import_match_type` schema add** — migration
  `20260501090000_books_import_match_type.sql` adds the column with a CHECK
  constraint and a partial index. Backfilled via
  `scripts/library-import/patch-import-match-type.ts` (1,238 rows updated;
  92 unmatched are mostly Brockhaus rewrites + 8 ambiguous title-collision
  pairs — they keep `import_match_type = NULL`, which the loader treats as
  "unknown" and the slice rail simply doesn't surface).
- **`/library` Drain queue handoff** — when the list-page `?needs_review=true`
  filter is active, the header swaps the `Search passage` button for a
  `Drain queue (<count>)` anchor.
- **Carry-forward updates**: `multiParam` lifted into
  `src/lib/library/server/url-params.ts` (shared by `/library` +
  `/library/review`); `import_match_type` added to `SPREADSHEET_OWNED_FIELDS`
  so Pass 2 keeps it fresh; `IMPORT_MATCH_TYPES` constant +
  `IMPORT_MATCH_TYPE_LABELS` map exported from `src/lib/types/library.ts`.

## Decided (non-obvious)

- **Explicit-user-reviewed `needs_review = false` overrides the auto-flag.**
  This is the new contract for the review queue — it deliberately differs
  from `parseBookForm` + `updateBookAction`, where `needs_review` snaps back
  to `true` whenever `computeMissingImportant` finds gaps. The review queue's
  whole point is letting the user say "yes, I know it's incomplete; stop
  flagging it." `stripReviewAutoLine` ensures the next `parseBookForm` save
  doesn't re-merge a stale auto-line on top of the user's note.
- **Local-state cursor + JSON refill endpoint, not URL-tracked skip list.**
  Skipped IDs grow to hundreds within a session; encoding them in the URL
  bloats every `goto()`. Instead, the page server load returns the first 10
  cards, and the page tracks `excludedIds: Set<string>` in `$state`. When
  the local stack drops below 3, a fetch to `/library/review/queue?exclude=…`
  pulls the next batch. Works because the queue is unordered (any 10
  `needs_review = true` rows is fine) and the URL stays clean for the
  filter pills.
- **Per-card text inputs only when the underlying field is null.** Adding a
  Title input to a card whose title is "Galatians" would push the user to
  re-type something that's already correct, and would make Save+next read
  weirdly. Hide the input when the field is set; show it only when the row's
  the one with the gap.
- **`subject=blank` URL alias, not `genre=null`.** `?subject=` matches the
  user's mental model — the source spreadsheet's Subject column is what
  generated the auto-flag. The schema name is `genre` because that's what we
  actually map Subject codes to, but the URL keeps the import-time vocabulary
  for queue navigation.
- **`?match_type=` filter requires the `import_match_type` column add.** The
  Open Library match metadata only existed in `enriched_library.csv` until
  this session. We could have heuristically derived it from `needs_review_note`
  text, but matching `/^OL match: /` is fragile (the Pass 1 importer only
  emits that line for `title-only`, not `no-match`). A real column + backfill
  + Pass-2-aware ownership in `SPREADSHEET_OWNED_FIELDS` is the durable shape.
- **No `<CardStack>` component extraction** — the page is the only consumer.
  Per `.cursor/rules/components.mdc`, extract on second usage.

## Schema changes

- `supabase/migrations/20260501090000_books_import_match_type.sql` — adds
  `books.import_match_type TEXT` with CHECK constraint
  (`'title+author' | 'title-only' | 'no-match' | NULL`) and partial index
  on live rows. NULL allowed for hand-created books and unmatched importer
  rows.

## New components / patterns added

- **`stripReviewAutoLine(note)`** in `src/lib/library/server/book-actions.ts`
  — sibling helper to `mergeReviewNote`. Strips a leading `Missing: …` line
  (and the blank line beneath it) while preserving any user-authored
  remainder. Reusable any time a "user reviewed; clear the auto-flag"
  contract surfaces.
- **`multiParam(url, key)`** lifted to
  `src/lib/library/server/url-params.ts` — shared between `/library`
  filter parser and `/library/review` slice parser. Same accept-both-CSV-
  and-repeated semantics from Session 3.
- **Card-stack pattern with JSON refill endpoint.** Page-local `$state`
  cursor + exclude set + `/library/review/queue/+server.ts` fetcher when
  the stack runs low. Pattern reuses any time we want a "drain a queue
  one-card-at-a-time without URL bloat" surface (post-trip OCR review queue,
  any future moderation queue).
- **Reviewable column add backfill script** — `scripts/library-import/
  patch-import-match-type.ts` reuses the importer's normalization helpers
  (NFD-fold + lowercase + strip leading article + parenthesized suffix). The
  ISBN-then-(title, first-author last_name) match strategy is the same shape
  as the importer; copy this script's structure for any future column-add
  backfill against Pass-1-imported rows. **Watch out for PostgREST's 16KB
  header cap** — `.in('id', [200+ UUIDs])` is the safe ceiling. We hit
  `HeadersOverflowError` at 500 on the first run.

## Open questions surfaced

- **Q13 — Skipped IDs persist only for the current page session.** Reload
  loses them and previously-skipped cards reappear. For a 50-cards-in-5-mins
  drain pass that's fine; for a multi-day spread of "skip this until I have
  the book in front of me" intentions, a `books.review_skipped_at` column
  would be needed. **Defer until trip use surfaces the friction.**
- **Q14 — 92 books with `import_match_type = NULL` post-backfill** (Brockhaus
  rewrites + 8 ambiguous title-collision pairs). The `?match_type=` slices
  exclude them; they're still drainable from the `All` slice and the
  `?subject=blank` slice. **Owner — accept; revisit if Pass 2 surfaces more
  unmatched rows.**

## Surprises (read these before the next session)

1. **PostgREST URL header cap is 16KB** — `id.in.(<UUIDs>)` with a 36-char
   UUID + comma overflows undici's HEADERS_OVERFLOW at ~440 entries (the
   library + auth headers eat the rest). The patch script started at
   `PAGE = 500` and crashed with a `HeadersOverflowError` on the people
   in-list. **Cap any `.in('uuid_col', slice)` at 200**. Same constraint
   bites the existing importer's `loadAuthorsForBooks` / `loadFirstAuthor…`
   paths if either ever has to operate on > 440 ids — they currently slice
   at 500 too. Not a problem at 1,331 books because no single in-list grows
   past the cap; will bite at ~5,000 books unless lowered first.
2. **Importing a named export from `+page.server.ts`** — `parseReviewFilters`
   is exported from `/library/review/+page.server.ts` and imported by the
   sibling `/library/review/queue/+server.ts`. SvelteKit only treats
   `load`, `actions`, `prerender`, `csr`, `ssr` as special; any other named
   export is just a regular module member. Cleaner than duplicating the
   parser into a third helper file when only one route + its sub-endpoint
   share it.
3. **`$state(data.foo)` on mount triggers Svelte's
   `state_referenced_locally` warning.** The intended pattern (re-seed via
   `$effect` when `data` changes) is correct, but the initial seed reads
   `data.foo` from a reactive prop in a non-reactive context. Wrap the
   initial value in `untrack(() => data.foo)` to silence the warning while
   keeping the `$effect` re-seed for filter changes. Matches the Session
   1.5h Surprise #17 untrack pattern exactly.
4. **Service-role UPDATEs against `books` still write
   `audit_log.changed_by = NULL`** (decision-008 Surprise #6 reconfirmed).
   Re-ran `scripts/library-import/patch-audit.ts` against the existing
   pass1_start cutoff to attribute the 1,238 backfill UPDATEs to owner.
   Pattern: every service-role bulk UPDATE follows with a patch-audit
   sweep of the same window.
5. **`<Button hotkey="Escape">` and `<svelte:window onkeydown>` Esc handler
   coexist cleanly.** The Skip button has `hotkey="Escape"` (bubble-phase,
   `defaultPrevented` bail), and the page's window listener also handles
   Esc → `skipCurrent()` so Esc works even when focus is on a chip button
   (which doesn't trigger the form's Esc). The window listener bails on
   text-input focus so users can press Esc to clear a focused field.
   Idempotent: when both fire, both call `skipCurrent()` against the same
   card, but the second call is a no-op because the card is already gone
   from the local stack.

## Carry-forward updates

- [x] `.cursor/rules/library-module.mdc` — added `stripReviewAutoLine` note
      next to the existing `mergeReviewNote` semantics; documented the
      review-queue's `needs_review = false` override contract.
- [x] `docs/POS_Library_Build_Tracker.md` Session 5.5 — marked done.
- [x] `scripts/library-import/SPREADSHEET_OWNED_FIELDS.ts` — added
      `import_match_type` so Pass 2 refreshes it.
- [x] `src/lib/types/library.ts` — exported `IMPORT_MATCH_TYPES`,
      `ImportMatchType`, `IMPORT_MATCH_TYPE_LABELS`, `ReviewQueueFilters`,
      `ReviewCard`.
- [ ] `.cursor/rules/components.mdc` — no new component (card-stack is
      page-local; one usage doesn't justify extraction). Revisit if a
      second card-stack surface ships post-trip.
- [ ] **Pending hands-on phone smoke** — drain 50+ cards in 5 minutes from a
      phone; capture 375px-wide screenshot for the tracker.

## Numbers

| Metric | Value |
|---|---|
| Migration applied | `20260501090000_books_import_match_type.sql` |
| Rows backfilled with `import_match_type` | 1,238 (865 by ISBN, 373 by title+author) |
| Rows kept NULL (Brockhaus rewrites + ambiguous) | 92 |
| Audit rows patched post-backfill | 1,238 |
| New routes | `/library/review`, `/library/review/queue` |
| New helpers exported | `stripReviewAutoLine`, `loadReviewQueue`, `countReviewQueue`, `multiParam` (lifted), `parseReviewFilters` |
| Page LOC | ~510 (single page; threshold ~150 for extraction was bumped because the surface is genuinely co-owned) |
