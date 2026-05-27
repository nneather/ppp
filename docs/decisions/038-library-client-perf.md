# 038 — Library client perf (search JSON, layout total, streamed refs, SW)

**Date:** 2026-05-26
**Module:** library | platform
**Tracker session:** n/a (perf plan)

## Built

- **`/library` list** — filter/search uses `fetch('/library/books.json')` + `replaceState` (no full `load` per keystroke); 300ms search debounce; `listFetchPending` spinner; `clientFilters` / `clientFilteredCount` mirror server data until invalidation.
- **`countLiveBooks`** moved to [`src/routes/library/+layout.server.ts`](../../src/routes/library/+layout.server.ts) so list filter refreshes skip an extra count round-trip.
- **Book detail** — `scriptureRefsPromise` streamed in load; scripture block shows loading placeholder until refs resolve; list book links use `data-sveltekit-preload-data="hover"`.
- **Service worker** — navigation HTML uses `StaleWhileRevalidate` instead of `NetworkFirst` (3s network wait) for faster repeat navigations while keeping offline fallback.

## Decided

- **`?all=true` still uses `goto`** — full-catalog path needs `paginateAll` in `loadBookListFiltered`; client JSON endpoint stays paged.
- **People facets lazy on list** — removed `loadPeople` from library layout; list loads `/library/people.json` after idle / when filter UI opens; book new/edit/review/detail page servers call `loadPeople` locally.
- **Signed URLs still batch in `loadScriptureRefsForBook`** — streaming the promise unblocks book header paint; per-row lazy signing left for a later pass.

## Schema changes

- None (remote DB confirmed up to date via `npm run supabase:db:push:dry` on 2026-05-26).

## New components / patterns added

- **List filter refresh** — `applyListFilters` + `books.json` + `replaceState`; reuse for any faceted list that should avoid SvelteKit `load` on query churn.
- **`GET /library/people.json`** — facet author picker payload decoupled from layout.

## Open questions surfaced

- Owner: capture `Server-Timing: total` on prod for `/library?q=…` and `/library/books/[id]` before/after deploy (targets in [033-performance-pass](033-performance-pass.md)).

## Surprises

- SvelteKit `replaceState` from `$app/navigation` updates the URL without re-running `load` — required for client-only list refresh.

## Carry-forward updates

- [ ] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (n/a — pattern noted here)
- [ ] new env vars documented (none)
