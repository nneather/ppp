# 281 — Apocrypha vocab (Session 0)

**Date:** 2026-10-20
**Module:** library
**Tracker session:** ad-hoc — [systematics-capture-checklist.md](../systematics-capture-checklist.md) Turretin step 2b

Design lock only. No migration and no `turretin:import --apply` in this session.

## Built

- Nothing in code or schema. The implementation prompt lives in PLAN.md › Session prompts.

## Decided

- **Testament is `AP`.** Widen `bible_books.testament` from `CHECK (testament IN ('OT','NT'))` to `('OT','NT','AP')`. UI label is "Apocrypha". Rejected stuffing these into `OT`, and rejected `DC` (Turretin argues they are not canonical; this library follows that).
- **All 18 NRSV Apocrypha units, not Turretin's 8.** Names are the FK strings `scripture_references.bible_book` will use. `sort_order` continues after Revelation (66); the NT is not renumbered.

| sort_order | name |
|---|---|
| 67 | Tobit |
| 68 | Judith |
| 69 | Additions to Esther |
| 70 | Wisdom of Solomon |
| 71 | Sirach |
| 72 | Baruch |
| 73 | Letter of Jeremiah |
| 74 | Prayer of Azariah |
| 75 | Susanna |
| 76 | Bel and the Dragon |
| 77 | 1 Maccabees |
| 78 | 2 Maccabees |
| 79 | 1 Esdras |
| 80 | Prayer of Manasseh |
| 81 | Psalm 151 |
| 82 | 3 Maccabees |
| 83 | 2 Esdras |
| 84 | 4 Maccabees |

  The 8 strings already in `scripts/ocr-index-eval/turretin-apocrypha-pending.json` match exactly (`2 Esdras`, `Tobit`, `Judith`, `Wisdom of Solomon`, `Sirach`, `Baruch`, `1 Maccabees`, `2 Maccabees`). No alias column on `bible_books`. `Letter of Jeremiah` is its own row; Vulgate Baruch 6 stays `Baruch` in Turretin's rows. `2 Esdras` is the NRSV name (4 Ezra); it sorts after `1 Esdras`.
- **`BIBLE_BOOK_NAMES` stays the closed 66.** Canon-index math keys off array position (`OT_BOOK_COUNT = 39`, `indexOf('Matthew')`, longest-first parse). Add `APOCRYPHA_BOOK_NAMES` (the 18, NRSV order above) and `ALL_BIBLE_BOOK_NAMES = [...BIBLE_BOOK_NAMES, ...APOCRYPHA_BOOK_NAMES]`. `getBibleBookNames({ includeApocrypha?: boolean })` defaults to the 66.
- **Grid gets an Apocrypha section.** `scripture-index.ts` buckets names in `APOCRYPHA_BOOK_NAMES` as `apocrypha` (NRSV order, below NT). The existing `other` bucket stays for names in neither list. Rejected leaving apocrypha in the alphabetical "Other" section, and rejected inserting them between Malachi and Matthew.
- **Aliases stay in TypeScript.** `turretin-apocrypha.ts` heading map is unchanged (`Son of Sirach` / `Ecclesiasticus` / `Wisdom of Sirach` → `Sirach`). `src/lib/mcp/bible-book.ts` gains `ecclesiasticus`, `sir`, `wis`, `tob`, `jdt`, `bar`, `1 macc`, `2 macc`, `4 ezra` → `2 Esdras`, and they resolve only when the caller passes `includeApocrypha: true`.
- **Verse-abs math does not change.** `compute_verse_abs()` and `search_scripture_refs` are per book (`chapter * 1000 + verse`). There is no cross-book absolute, and `bible_books` has no chapter-count column. Do not add one. Soft chapter ceilings for Turretin's 8 stay in `turretin-apocrypha.ts`.

### Show apocrypha

- `src/lib/library/scripture-index.ts` tallies + `scripture-index-summary.svelte` (new section; `other` kept).
- `<ScriptureReferenceForm>` bible-book picker. Book detail `startEdit` loads the row into this form; a Sirach row would otherwise render a blank select. `scripture-actions.ts` already trusts the FK.
- `parsePassageDisplay` in `src/lib/sermons/passage-parse.ts`: optional `names` argument, default the 66. `scripture-index.ts › parsePassageFilter` passes `ALL_BIBLE_BOOK_NAMES`, so the manage-page passage box accepts `Sirach 7:36`. Sermon and studies callers stay on the default.
- `/library/books/[id]/scripture` bible-book filter.
- `/library/search-passage`: param check in `+page.server.ts` and the `<select>` in `+page.svelte`. The grid chip href must resolve.
- `/settings/library/bible-books` third section, and `loadBibleBookList`'s testament union `'OT' | 'NT' | 'AP'`.
- MCP `list_systematics_for_passage` only (`scripts/ppp-mcp/tools.ts`). `search_library` has no `bible_book` argument. `resolveBibleBookName` / `bibleBookSuggestions` take `{ includeApocrypha: true }` from that one tool.
- `supabase/seed/library_seed.sql` (header currently says 66).

Layout: `src/routes/library/+layout.server.ts` keeps returning `bibleBookNames` (66). Add `allBibleBookNames`. Book detail threads the 66 into `<BookBibleCoverageEditor>` and `<PassageSectionForm>` and the full list into `<ScriptureReferenceForm>` only.

### Canon only

- `/studies/by-book` spine (`by-book.ts`; sermons loader skips coverage names outside `BIBLE_BOOK_NAMES`).
- Studies resource sets, import-suggest, `/studies/papers?bible_book=`, `studies/passage-ranges.ts`.
- Sermon passage parse default, sermon actions, `<SermonFormSheet>`.
- `/library` coverage facet and bulk coverage select (`url-params.ts`), `<BookBibleCoverageEditor>`, `<PassageSectionForm>`. After the migration the FKs on `book_bible_coverage.bible_book` and `book_passage_sections.bible_book` will accept an apocrypha name; the pickers stay canon on purpose.
- MCP `list_commentaries_for_bible_book` and `list_sermons_for_bible_book` (tool text says "Protestant Bible book").
- OCR Edge allowlist (`supabase/functions/ocr_scripture_refs/bible-book-allowlist.ts` and the prompt) and client `scripture-index-validate.ts`. An OCR'd apocrypha row is dropped by the Edge and flagged `unknown_bible_book` on the client. Revisit when a Calvin apocrypha leaf is actually OCR'd. No Edge redeploy in the implementation session.
- `scripts/ocr-index-eval/turretin-apocrypha.ts` stays Turretin's 8. A test asserts that list is a subset of `APOCRYPHA_BOOK_NAMES`. Drop the "vocab is deferred" lines there and in `scripts/ocr-index-eval/README.md`.

### Import (implementation session, after the migration)

`import-turretin-index.ts` reads `bible_books` at run time; the script does not change. Dry run must show 51 inserts and 0 `bible_book_not_in_vocab`, split **I 38 / II 9 / III 4**. `--apply` inserts those 51 and rewrites `turretin-apocrypha-pending.json` with empty `books` and `rows`. Do not start van Mastricht or Bavinck.

### Migration sketch (implementation session)

`supabase/migrations/<ts>_bible_books_apocrypha.sql`: confirm the CHECK name in `pg_constraint` (expected `bible_books_testament_check`), drop it, add `CHECK (testament IN ('OT','NT','AP'))`, `INSERT … ON CONFLICT (name) DO NOTHING` for the 18 rows. No new table, so no grants, RLS, or audit trigger (`bible_books` is a documented exception). Run `npm run supabase:gen-types` in the same commit (diff should be empty; `testament` is already `string`). Ship with `npm run ship-library` then `ship-library:apply`.

### Tests the implementation must update

- `src/lib/library/__tests__/scripture-index.test.ts` — `Tobit` moves from `other` to `apocrypha`; a name in neither list (e.g. `Enoch`) stays in `other`.
- `src/lib/mcp/__tests__/bible-book.test.ts` — `sirach` / `ecclesiasticus` → `Sirach` with the flag; null without it.
- `src/lib/sermons/__tests__/passage-parse.test.ts` — default still rejects `Sirach 7`.

### Checked and left alone

`compute_verse_abs`, `search_scripture_refs`, `library_scripture_ref_counts` (no `bible_books` join). Manage-page order is `verse_start_abs` only. `scripture-ref-format.ts`, `passage-search-bands.ts`, `outline.ts`, `systematics-loaders.ts`, audit-log labels, generated `database.ts`, `restore-smoke.sh` (dumps `bible_books`, asserts no count), RLS smoke, `library-migrate-local-to-prod` (does not copy reference rows).

## Schema changes

- None this session.

## New components / patterns added

- None. The implementation adds constants in `src/lib/library/bible-book-names.ts`, not a component.

## Open questions surfaced

- OCR Edge allowlist stays canon-only until a Calvin (or other) apocrypha index leaf is OCR'd. Owner: Parker, at that capture.

## Surprises (read these before the next session)

- Parker widened the vocab from Turretin's 8 to the full NRSV 18. The pending file's 8 names are a subset; the other 10 have no rows yet.
- `parsePassageDisplay` is shared. Widening it by default would let sermon and paper passage fields accept Sirach. The optional `names` argument is the seam.
- Book detail passes one `bibleBookNames` array into the scripture form, the coverage editor, and the passage-section form. Only the scripture form gets `allBibleBookNames`.
- `book_bible_coverage` and `book_passage_sections` FKs will accept `AP` names as soon as the rows exist. The pickers stay closed so that does not become a feature by accident.
- Pending-file volume split is I 38 / II 9 / III 4 (51 rows). An earlier guess of 36 / 9 / 6 was wrong.

## Carry-forward updates

- [x] components.mdc — n/a
- [x] AGENTS.md inventory — n/a (no helpers yet; implementation session updates it)
- [x] new env vars — none
- [x] checklist — step 2b points here
- [x] PLAN.md — implementation prompt appended
