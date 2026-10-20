# 280 — Scripture index on book detail

**Date:** 2026-10-20
**Module:** library
**Tracker session:** ad-hoc — Turretin import made the 1000-row PostgREST cap visible on book detail

## Built

- Migration `20261020152000_library_scripture_ref_counts.sql` — `library_scripture_ref_counts(p_book_ids uuid[])` returns `(book_id, bible_book, chapter_start, n)` for live rows. `LANGUAGE sql STABLE SECURITY INVOKER`; `REVOKE` from `PUBLIC`/`anon`; `GRANT EXECUTE` to `authenticated`. Uses `idx_scripture_references_book_id_live`.
- Pure helpers `src/lib/library/scripture-index.ts` + `__tests__/scripture-index.test.ts` — aggregate tallies (OT/NT/other, chapter chips), inline threshold (≤150), manage URL filters, passage/page parse, passage-search href.
- Loaders `src/lib/library/server/scripture-index-loaders.ts` — counts RPC, paginated rows (+ outline labels), `locateScriptureRef`, capped image thumbs. Set scope via `loadSetVolumeBooks`.
- `GET /library/books/[id]/scripture-refs.json` — auth gate; popup rows, inline list, locate deep-link.
- Book detail: drop full `loadScriptureRefsForBook` stream; stream counts + images instead. Header chip uses RPC total.
- Components:
  - `scripture-index-summary.svelte` — header, This volume | Whole set (only when ≥2 live series volumes), Bible-book grid or small-book inline list, Manage all link, recorded images.
  - `scripture-index-dialog.svelte` — chapter chips + rows; dynamic-imported on first open; deep-link `initialChapter` + highlight scroll after rows load.
  - `scripture-index-row.svelte` — shared passage/pages/vol tag/outline/review/edit/delete.
  - `scripture-index-table.svelte` — manage-page table / stacked mobile rows.
- Manage page `/library/books/[id]/scripture` — URL filters (scope, bible book, chapter, passage, page, needs review), 100/page, multi-select bulk bar, inline edit.
- Bulk actions in `scripture-actions.ts`: soft-delete + undo, flag/clear `needs_review`; ids chunked ≤200 and always `.in('book_id', scopeBookIds)`.

## Decided

- **Small books stay inline** (≤150 refs in current scope). Most commentaries never see the grid UI.
- **Volume is the default scope.** Whole set only when the series has 2+ live volumes; toggle is hidden otherwise.
- **Popup stays light.** Passage study still goes to `/library/search-passage`; the dialog is browse + edit/delete.
- **Deep links** `#ref-<uuid>` locate the row, open the matching Bible-book dialog on that chapter, and highlight briefly.
- **Manage is book/set-scoped.** Library-wide find stays on passage search.
- Rejected: moving refs between volumes; a separate set-level page; apocrypha chips (waits on `bible_books` vocab — [279](279-turretin-index-import.md)).

## Schema changes

- `supabase/migrations/20261020152000_library_scripture_ref_counts.sql` — counts RPC + grants. Applied to hosted prod; types regenerated.

## Security

- RPC is `SECURITY INVOKER` so existing `scripture_references` RLS applies. Viewer can read counts for books they can read; writes remain owner (existing actions + bulk).
- Bulk soft-delete / undo / needs_review always filter by `book_id ∈ scopeBookIds` (defense in depth vs id spoofing across books).
- JSON endpoint requires session; locate/list only return rows the caller can read under RLS.
- Security Review: clean (RPC INVOKER + bulk `book_id` scope).
- Bugbot fixes before close: dialog chapter resets on bible-book change; deep-link seeds `initialChapter`; highlight scrolls after rows load; whole-book (`chapter_start` null) gets a **Book** chip + `whole_book=1` filter; edit locate failure shows Cancel instead of an infinite skeleton.

## New components / patterns added

- See Built. Update `components.mdc` + AGENTS.md inventory.

## Open questions surfaced

- Apocrypha still absent from the grid until vocab migration ([279](279-turretin-index-import.md)).
- Optional: move-between-volumes bulk action (explicitly out of scope).

## Surprises (read these before the next session)

- PostgREST’s 1000-row default made Turretin vol II’s header and list both wrong (~4,981 live). Counts RPC is the durable fix; never re-fetch the full list on book detail.
- Dialog chapter state must reset when `bibleBook` changes; deep-link must seed `initialChapter` or the previous book’s chapter sticks.
- A `#ref-` on another volume has to switch scope to Whole set before the dialog fetch, or the row is filtered out. Index row order is `verse_start_abs` (canon), not `bible_book` (alphabetical).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] PLAN.md refreshed
