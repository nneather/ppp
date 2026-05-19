# 037 — Publishers PostgREST embed disambiguation (list + review queue hotfix)

**Date:** 2026-05-19  
**Module:** library  
**Tracker session:** hotfix (post Session 8.5 / publishers migration)

## Built

- **`PUBLISHER_EMBED` in `src/lib/library/server/loaders.ts`** — `publishers (...)` → `publishers!books_publisher_id_fkey (...)` so PostgREST knows which FK to follow when embedding from `books`.

## Decided

- **Primary publisher FK only in list/detail/review loaders** — citation embed uses `books.publisher_id`; reprint registry (`reprint_publisher_id`) stays plain columns / text fields until a loader needs the joined reprint imprint row (then add a second explicit embed, e.g. `publishers!books_reprint_publisher_id_fkey` with its own alias).

## Schema changes

- None (fix is app-side select string only).

## New components / patterns added

- None — one constant change; pattern documented below.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- **Adding a second FK to the same parent table breaks unqualified PostgREST embeds.** Migration `20260521120000_publishers.sql` added both `publisher_id` and `reprint_publisher_id` → `publishers`. Any existing `publishers (...)` on `books` selects returned **PGRST201** (“more than one relationship was found”). Loaders logged the error and returned `[]` / `null`, so `/library` and `/library/review` looked empty with no user-visible error.
- **Always disambiguate with `!constraint_name`** when a child table has multiple FKs to one parent. Response JSON key stays `publishers` unless you add an explicit alias prefix (`reprint_pub:publishers!books_reprint_publisher_id_fkey`).

## Carry-forward updates

- [x] `library-module.mdc` — multi-FK embed rule under Publisher citations
- [x] `AGENTS.md` — `PUBLISHER_EMBED` note on loaders inventory line
