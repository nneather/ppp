# 033 — Performance pass (library list, book detail, guardrails)

**Date:** 2026-05-20
**Module:** library | platform
**Tracker session:** n/a (cross-cutting)

## Built

- Migration `20260520120000_library_perf_indexes.sql` — btree indexes on `book_authors.person_id`, live `scripture_references` / `book_topics` by `book_id`, `books` review + facet columns.
- `loadBookListFiltered` — server `limit`/`offset` + parallel exact `filteredCount`; keyword author match in one `book_authors` + `people!inner` query; `BOOK_LIST_SELECT` embeds `people` so `/library/books.json` skips `loadPeople` per scroll chunk.
- Book detail load diet — dropped `loadPersonBookCounts`, `loadAllTopicCounts`, `loadAncientTexts` from default load; lazy `GET /library/topic-counts.json` and `GET /library/ancient-texts.json`; streamed `bookTopicsPromise`, `bibleCoveragePromise`, `ancientCoveragePromise`.
- `hooks.server.ts` — per-request `safeGetSession` memo; `Server-Timing: total;dur=…` header.
- `signStorageUrlsLimited` + 24h signed-URL TTL; replaced unbounded parallel signing in scripture/topic loaders.
- Scoped `invalidate('app:library:…')` on list, book detail, review, new/edit book routes.
- Root layout — `<hr>` instead of shadcn `Separator` (drops `bits-ui` from global chunk).
- Vite `manualChunks` for `supabase` + `lucide`.
- `.cursor/rules/performance.mdc` + AGENTS.md performance budgets block.

## Decided

- **DB title order for paginated list** — paginated pages use `ORDER BY title` at Postgres, then `titleSortKey` sort on the 50-row slice only. Full-catalog German article sort remains on `?all=true` / client-side prune paths.
- **Keep `paginateAll` on library layout** — `loadPeople` (~900 rows) once per `/library/*` nav is acceptable vs. denormalizing author labels on every book row.
- **No `invalidateAll` in library routes** — replaced with keyed invalidation; review queue uses `app:library:review`.

## Schema changes

- `supabase/migrations/20260520120000_library_perf_indexes.sql` — five partial/btree indexes (see Built).

## New components / patterns added

- `src/lib/library/sign-storage-urls.ts` — bounded Storage URL signing.
- `src/routes/library/topic-counts.json/+server.ts`, `src/routes/library/ancient-texts.json/+server.ts` — lazy editor deps.
- `.cursor/rules/performance.mdc` — loader/index/invalidate budgets.

## Open questions surfaced

- Owner: run `npm run supabase:db:push` + capture before/after `Server-Timing` on `/library?q=…`, `/library/books/[id]`, and one `/library` → `/library/review` nav (DevTools Network).

## Surprises (read these before the next session)

- `+server.ts` routes do not receive SvelteKit `parent()` layout data — infinite scroll avoids refetching `loadPeople` by embedding `people` on `book_authors` in `BOOK_LIST_SELECT` instead.
- PostgREST filter on joined `people.last_name` for keyword search replaces the serial people-then-`book_authors` prelude.

## Carry-forward updates

- [x] components.mdc updated (n/a — no new UI components)
- [x] AGENTS.md inventory updated
- [ ] new env vars documented (none)
- [ ] tracker Open Questions updated (n/a)

## Before / after (owner to fill after `db push`)

| Surface | Before (approx) | After (target) |
|---------|-----------------|----------------|
| `/library?q=…` | 5s+ / ~2s phone PWA (2026-06) | < 500 ms server `total` |
| `/library/books/[id]` | ~2 s | < 600 ms |
| `/library/*` nav | ~1.5 s / ~1s phone PWA (2026-06) | < 500 ms server `total` |

Measure via Chrome DevTools → Network → `Server-Timing` (`auth`, `db`, `total`). See [044-pwa-responsiveness.md](044-pwa-responsiveness.md) for the 2026-06 pass.

Automated gate (optional): `npm run test:perf` with `PERF_SMOKE_*` — [scripts/perf-smoke/README.md](../../scripts/perf-smoke/README.md).
