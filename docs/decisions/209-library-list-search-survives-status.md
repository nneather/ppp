# 209 — Library list search survives status / bulk edits

**Date:** 2026-08-24
**Module:** library
**Tracker session:** ad-hoc — keep `?q=` when changing reading status on `/library`

## Built
- `libraryListFormAction` in [`src/lib/library/server/url-params.ts`](../../src/lib/library/server/url-params.ts) — named form action that appends the current list query (`?/updateReadingStatus&q=…`) instead of replacing it.
- `/library` reading-status, bulk-update, and undo forms use that helper. Status + bulk `enhance` now call `update({ reset: false, invalidateAll: false })` so the client JSON overlay is not wiped. After bulk (and after status when a reading-status facet is on) we re-fetch via `applyListFilters` so the list stays honest.
- Unit tests for the helper in `src/lib/library/__tests__/url-params.test.ts`.

## Decided
- Search stays. There is no product reason to clear `q` when you change a row’s reading status or apply a bulk patch — search is the primary verb; status is just another facet. The wipe was a bug, not a workflow.
- Facet chips already composed with `q` via `{ ...filters }`. Row mutations now do the same.
- Do **not** `invalidateAll` after a status change: that re-runs `load` against a URL that lost `q` (or, even with `q` restored, the page `$effect` resets `clientFilters` from server `data.filters` and drops the JSON overlay). Same `invalidateAll: false` stance as the review queue ([009](009-library-review-queue.md)).
- If a reading-status **facet** is active, refresh the JSON list after a status change so a book that no longer matches can leave the set. Otherwise keep the current hits and optimistic badge.

## Schema changes
- None.

## New components / patterns added
- `libraryListFormAction(name, url)` — required for any POST on `/library` while the list is a `replaceState` + `books.json` overlay ([038](038-library-client-perf.md)).

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- HTML `action="?/updateReadingStatus"` is **query-relative**: the browser replaces the entire search string, so `?q=Calvin` becomes `?/updateReadingStatus`. SvelteKit then `invalidateAll`s from that URL; the list `$effect` clears `clientFilters` and the search box goes empty.
- `replaceState` does not re-run `load`, so `data.filters` still has no `q` after a client search. Any full invalidation without restoring the client overlay looks like “search disappeared.”

## Carry-forward updates
- [x] `.cursor/rules/library-module.mdc` (optimistic inline edit + URL-param list POSTs)
- [x] AGENTS.md inventory (`libraryListFormAction`)
- [ ] new env vars — n/a
- [x] tracker note
