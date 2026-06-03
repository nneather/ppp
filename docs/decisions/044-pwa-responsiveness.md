# 044 — PWA responsiveness pass

**Date:** 2026-06-03
**Module:** platform | library
**Tracker session:** n/a (cross-cutting)

## Built

- **Auth floor** — `resolveSessionUser()` uses cookie `getSession()` first, `getUser()` only when absent ([`src/lib/server/auth-session.ts`](../../src/lib/server/auth-session.ts)).
- **Server-Timing segments** — `auth` + `db` via `event.locals.perf` ([`src/lib/server/perf.ts`](../../src/lib/server/perf.ts), [`src/hooks.server.ts`](../../src/hooks.server.ts)).
- **Library list diet** — migration `20260603160000_books_list_denorm_search.sql`: `author_display`, `publisher_*_display`, `search_vector` + GIN index; triggers refresh denorm; list `BOOK_LIST_SELECT` drops nested embeds.
- **Search** — single `textSearch('search_vector', …)` round-trip; `count: 'estimated'` when `q` is set.
- **Round-trip collapse** — combined count+page query; layout drops `countLiveBooks` + `loadBibleBookNames` query (static [`bible-book-names.ts`](../../src/lib/library/bible-book-names.ts)); page reuses `filteredCount` as corpus total when unfiltered.
- **Nav perceived speed** — `preload-code=eager`, tab `preload-data=hover` + `pointerdown`/`touchstart` `preloadData`, `NavModuleSkeleton` on `navigating` ([`+layout.svelte`](../../src/routes/+layout.svelte)).
- **Client diet** — deferred `MultiCombobox` import on `/library` ([`+page.svelte`](../../src/routes/library/+page.svelte)).
- **PWA vocab cache** — Workbox SWR for `/library/people.json`, `series.json`, `topic-counts.json`, `ancient-texts.json` only ([`service-worker.ts`](../../src/service-worker.ts)).
- **Invoicing** — `invoicing_unbilled_counts()` RPC replaces unbounded unbilled row fetch.
- **Perf smoke** — `npm run test:perf` ([`scripts/perf-smoke/`](../../scripts/perf-smoke/)).

## Decided

- **`getSession` over `getUser` for navigation** — removes Auth HTTP hop when JWT is in cookies; `getClaims()` when the installed supabase-js exposes it + asymmetric keys are enabled.
- **Estimated count on keyword search** — UI shows “N filtered (T total)”; exact filtered count on search was dropped for latency.
- **No HTML / `books.json` SW cache** — iOS PWA tab regression from 038; vocab JSON only.

## Schema changes

- `20260603160000_books_list_denorm_search.sql`
- `20260603160100_invoicing_unbilled_counts_rpc.sql`

## New components / patterns added

- [`nav-module-skeleton.svelte`](../../src/lib/components/nav-module-skeleton.svelte)
- [`library/series.json`](../../src/routes/library/series.json/+server.ts) — optional facet cache endpoint

## Open questions surfaced

- Owner: run `npm run supabase:db:push` + fill before/after table in [033-performance-pass.md](033-performance-pass.md) from phone PWA `Server-Timing` headers.

## Surprises (read these before the next session)

- `@supabase/supabase-js` in this repo does not yet export `getClaims()` — fast auth uses `getSession()` until package + dashboard JWT keys are upgraded.

## Carry-forward updates

- [x] performance.mdc updated
- [x] AGENTS.md inventory updated (perf smoke script)
- [ ] new env vars documented (`PERF_SMOKE_*` optional — see scripts/perf-smoke/README.md)

## Before / after (owner to fill after deploy)

| Surface | Before (phone PWA) | After (target) |
|---------|-------------------|----------------|
| `/library` nav | ~1s | < 500 ms server `total` |
| `/library?q=…` | ~2s | < 500 ms server `total` |
| Tab switch (other modules) | 1–3s felt | skeleton immediate; server < 800 ms |

Measure: DevTools → Network → `Server-Timing` (`auth`, `db`, `total`). Wall time = server + client hydration.
