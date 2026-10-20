# 282 — Apocrypha vocab implementation

**Date:** 2026-10-20
**Module:** library
**Tracker session:** ad-hoc — [systematics-capture-checklist.md](../systematics-capture-checklist.md) Turretin step 2b

## Built

- Migration `20261020161445_bible_books_apocrypha.sql`: dropped `bible_books_testament_check` (confirmed in `pg_constraint`) and re-added `CHECK (testament IN ('OT','NT','AP'))`. Inserted the 18 NRSV Apocrypha rows at `sort_order` 67–84, `ON CONFLICT (name) DO NOTHING`. No grants, RLS, or audit trigger (`bible_books` is a documented exception). `npm run supabase:gen-types` diff was empty (`testament` was already `string`).
- `APOCRYPHA_BOOK_NAMES`, `ALL_BIBLE_BOOK_NAMES`, and `getBibleBookNames({ includeApocrypha })`. Layout still returns `bibleBookNames` (66) and now also `allBibleBookNames`.
- Apocrypha shown on the scripture-index grid (NRSV order, `other` kept), `<ScriptureReferenceForm>` only, the manage-page bible-book select, `/library/search-passage` (param check + select), `/settings/library/bible-books`, `loadBibleBookList` (`'AP'`), and MCP `list_systematics_for_passage` (aliases `ecclesiasticus`, `sir`, `wis`, `tob`, `jdt`, `bar`, `1 macc`, `2 macc`, `4 ezra` → `2 Esdras`, flag-only). `parsePassageDisplay` takes an optional names list; only `parsePassageFilter` passes the full list. Seed file updated.
- `npm run turretin:import` dry run: **51 inserts, 0 `bible_book_not_in_vocab`**, I 38 / II 9 / III 4. `--apply` at `2026-10-20T16:22:42.979Z` inserted 51, revived 0. `turretin-apocrypha-pending.json` `books` and `rows` are empty. Live counts: 2 Esdras 3, Tobit 7, Judith 4, Wisdom of Solomon 8, Sirach 10, Baruch 1, 1 Maccabees 9, 2 Maccabees 9.

## Decided

- Canon surfaces stay on the 66: by-book spine, studies sets/import/papers, sermon parse default and actions, coverage facet, `<BookBibleCoverageEditor>`, `<PassageSectionForm>`, MCP commentaries/sermons, OCR Edge allowlist, and `scripture-index-validate.ts`. No Edge redeploy (`ship-library:apply` would have deployed functions; this session ran `db push` + `gen-types` + `test` only).
- Commentary title auto-detect filters out testament `AP`, so a Tobit commentary title does not write `book_bible_coverage` through the canon picker.
- `loadScriptureIndexCounts` pages the RPC. The three Turretin volumes together are 1,868 `(book, chapter)` groups; PostgREST's 1000-row cap was dropping later names (Sirach, Tobit, Judith, Wisdom) from the set-wide tally the volume grid filters. Each page is 1000 rows. The SQL function is unchanged.

## Schema changes

- `supabase/migrations/20261020161445_bible_books_apocrypha.sql` — testament `AP` + 18 rows.

## New components / patterns added

- None. Constants live in `src/lib/library/bible-book-names.ts`.

## Open questions surfaced

- OCR Edge allowlist stays canon-only until a Calvin (or other) apocrypha index leaf is OCR'd. Owner: Parker, at that capture. Unchanged from [281](281-apocrypha-vocab.md).

## Surprises (read these before the next session)

- The counts RPC is ordered by `bible_book`, so a truncated set-wide payload keeps `1 Maccabees` / `Baruch` / `2 Esdras` and drops `Sirach`. Paging is required whenever the grid loads more than one fat volume.
- Sirach 7:36 is volume III page 561 (resurrection). The manage page defaults to this volume, so that passage is empty on vol I and hits on Whole set.
- Dry run rewrites `turretin-apocrypha-pending.json` before `--apply`. The source of the rows is still `turretin.rows.json`.

## Carry-forward updates

- [x] components.mdc — scripture-index summary mentions the Apocrypha section
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] checklist — step 2b marked applied
- [x] PLAN.md — prompt removed
