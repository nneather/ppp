# 012 — Library Session 7 slice: people settings + merge

**Date:** 2026-05-02  
**Module:** library  
**Tracker session:** Session 7 (slice 1 — people only)

## Built

- `/settings/library` **hub** (`+page.svelte`) — Overview landing with links to People, Genres, Categories, Bible books; owner link to merge suggestions. Removed redirect-only `+page.server.ts` so the Settings hub URL is a real page.
- `/settings/library/people` — paginated cap (500 + refine hint), `?q=` last-name search (ILIKE), table with **live** book link counts (`book_authors` joined to non-deleted `books`), **chunked** `person_id` `.in()` queries (100 ids/request) to avoid PostgREST header limits; `bookCountError` surfaced when counts fail.
- `/settings/library/people/merge` (owner-only) — B14-based suggested pairs (`suggestB14MergePairs` in [`people-actions.ts`](../../src/lib/library/server/people-actions.ts)), dismiss persisted in **`localStorage`** key `ppp.library.mergeDismissedPairs` (browser-only), manual two-select merge + same `mergePeople` RPC; successful merge auto-dismisses that pair key in LS.
- Postgres `library_merge_people(p_canonical, p_merged_away)` — `SECURITY DEFINER`, owner gate, atomic `book_authors` / `essay_authors` repoint + dedupe + merged-away soft-delete with `merged_into_id`.
- `people.merged_into_id` self-FK — distinguishes merge soft-delete from normal settings soft-delete for audit policy.
- `write_audit_log()` — merge soft-delete on `people` (`deleted_at` set from live + `merged_into_id IS NOT NULL`) logs `revertible = false`.
- Audit log UI + revert action — soft-delete / soft-restore revert now requires `audit_log.revertible` so merged-away rows cannot be “restored” from the UI or a crafted POST (closes gap where `_SOFT_DELETE_REVERTIBLE_TABLES` ignored the flag).
- `depends('app:library:people')` on `/library/books/new` and `/library/books/[id]/edit` loads + `invalidate('app:library:people')` after people mutations so author pickers refresh after merge/settings edits.
- Library settings layout: **Overview** tab (`/settings/library`), People, **Merge** (owner-only), Genres, Categories, Bible books. `+layout.server.ts` exposes `isOwner` for tab visibility and hub merge link.

## Decided

- **Single POST merge with heavy confirm** (not a wizard): one modal lists remove vs keep-with-search; confirm runs one `mergePeople` action + RPC.
- **RPC vs app-layer multi-update:** merge must be transactional; Supabase client has no transaction API across junction + person updates, so a single plpgsql function is the source of truth.
- **Normal people soft-delete stays audit-revertible:** only rows with `merged_into_id` set at soft-delete time get `revertible = false` in `audit_log`; manual remove from settings leaves `merged_into_id` null.
- **Dismiss suggested pairs in `localStorage` only** (`ppp.library.mergeDismissedPairs`) — no cross-device sync until a future DB-backed dismiss table is justified.
- **Junction dedupe:** `book_authors` PK `(book_id, person_id, role)` — delete merged-away row when canonical already occupies that slot; `essay_authors` PK `(essay_id, person_id)` — same idea.

## Schema changes

- `supabase/migrations/20260502120000_library_merge_people.sql` — `people.merged_into_id`, `write_audit_log` people-merge branch, `library_merge_people`, `GRANT EXECUTE` to `authenticated`.

## New components / patterns added

- `src/lib/library/server/people-settings-actions.ts` — settings-only people CRUD + merge wrapper (documented in AGENTS.md). No new shared UI component (edit + merge live in the route page).
- `src/lib/library/server/people-settings-book-counts.ts` — `fetchLiveBookIdsByPersonId` (chunked `book_authors` + `books!inner` live filter) for People + Merge pages.

## Open questions surfaced

- Viewer smoke for merge 403 — run when viewer auth seed is available (tracker Session 1 note).
- Remaining Session 7 tracker rows: series polish, ancient_texts CRUD+merge, translator migration, permissions UI, read-only genre/category/bible pages.

## Surprises (read these before the next session)

- Audit soft-delete revert previously ignored `revertible`; merge would have been undoable without the `revertible` gate + DB flag alignment.

## Carry-forward updates

- [x] AGENTS.md inventory updated (`people-settings-actions.ts`, `people-settings-book-counts.ts`)
- [ ] components.mdc updated — no new shared component
- [x] `library-module.mdc` — Session 7 people settings pattern
- [ ] new env vars documented — none
- [x] tracker Session 7 people row + build notes (see tracker)
