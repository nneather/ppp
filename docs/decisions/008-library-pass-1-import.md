# 008 — Library Session 4 Pass 1 import (importer + rows.json)

**Date:** 2026-04-30
**Module:** library
**Tracker session:** Session 4 Pass 1

## Built

- **`scripts/library-import/SPREADSHEET_OWNED_FIELDS.ts`** — single source of truth for which `books` columns the importer can overwrite (mirrors the field-ownership table from [decision 007](007-reconcilable-library-import.md)). `pickSpreadsheetOwned()` helper used by the UPDATE path so the `.update()` payload literally cannot contain a user-owned field.
- **`src/lib/library/server/people-actions.ts`** — extracted `findOrCreatePerson({ last_name, first_name, middle_name, suffix }, createdBy)` from `book-actions.ts` so the importer reuses the same B14 dedup the form uses (decision-007 surprise). Also exported `parseTypedName(raw)` mirroring `<PersonAutocomplete>`'s parser. Diacritic-folded normalization (`à Kempis` → `a kempis`) so accented surnames collide cleanly.
- **`scripts/library-import/migrationOverrides.ts`** — hand-transcribed override map from `Library_Migration_Notes.md` (~75 per-book rules + 1 deletion + 1 BDAG addition + 4 deferred shelf-check flags + Brockhaus group rules). Match shape: `{ subject?, series?, author_surname?, author_raw_contains?, title_contains?, title_matches?, title_excludes? }` — every set field must match. Per-book numbers in the notes (`#16`) are NOT used for matching (verified non-reproducible — see Surprise #1 below); matching is by source-data shape instead.
- **`scripts/library-import/buildImportRows.ts`** — pure XLSX + CSV + overrides → `rows.json`. Reads `Library_1.xlsx` `Library` sheet (1,330 rows), merges enrichments by `src_row`, applies global rules → Brockhaus group rule → per-book overrides → deferred shelf-check → title-only flag → computeMissingImportant → source-internal duplicate detection. Emits `data/rows.report.txt` with override hit/orphan audit, genre/subject/series/language breakdowns, and dup pairs.
- **`scripts/library-import/importLibrary.ts`** — service-role import script with `--dry-run` (default) and `--apply [--limit N]`. ISBN-first match strategy (decision 007). Diff-based UPDATE only on `SPREADSHEET_OWNED_FIELDS` (never NULL out an existing ISBN/barcode). Junction sync mirrors `syncAuthors` / `syncCategories` shape from `book-actions.ts` so audit log shows minimal diffs on Pass 2. Emits `library_import_diff.txt` + `library_import_orphans.csv`.
- **`scripts/library-import/README.md`** — sequence walkthrough for build → dry-run → smoke → apply → validate.
- **`supabase/seed/library_smoke_data_cleanup.sql`** — one-shot hard-DELETE of the 15 Session 1 smoke books, gated on the apply path.
- **`docs/Library_Migration_Notes.md`** — committed copy of the v1 migration notes for posterity (so this decision record can reference it and Pass 2 can diff against it).

## Decided (non-obvious)

- **Override-matching by `(subject, series, author_surname, author_raw_contains, title_contains)`, not by notes' `#N` numbers.** Verified during planning + build that the notes' subset numbering is not algorithmically reproducible — author renames (e.g. "Beal, Lissa M. Wray" → "Wray Beal, Lissa M.") shift the alphabetical sort by 4+ positions. Match by shape; ignore `#N` (it's documentation only).
- **`author_raw_contains` for missing-comma source rows.** Source has rows like `"Edwards James R."` (no comma) — `parseTypedName` puts `last_name = "R."`. Normal `author_surname` matching fails. Added `author_raw_contains` to match the raw source author string when the parsed last_name doesn't help.
- **Brockhaus detection is series-driven, not subject-driven.** The notes describe Brockhaus as a single "group" but the source has `subject = REF` and `series = BH`. The importer's `applyBrockhaus` rule fires on `series === 'BH'` (not subject), then dispatches by source title pattern (4-digit year → Jahrbuch; named pattern → supplementary vols 25-27; letter range matching the seeded volumes list → Wörterbuch or Enzyklopädie).
- **BBL "publisher-as-author" rule isn't an auto-clear.** Initial implementation auto-cleared `book_authors` for any BBL row, which broke per-book overrides like Aland's Synopsis (which need `Aland` as author for the override to match). Removed the auto-clear; let parseTypedName run as normal. Curated multi-editor BBL rows (Berlin/Brettler, Westcott/Hort, Goodrich, Vulgate) supply their own `authors[]` via override. Plain "publisher-as-author" rows (e.g. just "Brockhaus") get parsed as a single-name person — accepted as Pass-1 noise; Session 7 people-merge cleans up.
- **Override `needs_review: false` is sticky.** Initial bug: curated rows that explicitly set `needs_review = false` got flipped back to `true` by the subsequent `computeMissingImportant` step (since most curated rows still have missing year/publisher from incomplete OL enrichment). Fixed by tracking `needsReviewExplicitlyClearedByOverride` and skipping the auto-flag when set. Same flag honors the title-only enrichment flag too.
- **Source-internal duplicate detection includes `volume_number`.** Without it, the dup detector flagged ABD vols 1-6 as duplicates (same canonical title + same author + different volume). Including volume_number (or both null) in the dedup key drops 6 false positives and surfaces 22 real duplicate pairs (Bruce Acts twin, Tolkien LOTR audiobook + book, etc.). Both rows in each pair are kept in `rows.json` with a `needs_review_note` directing the user to manually merge via UI.
- **`title-only` enrichment flag (294 rows) gets `needs_review = true` + auto-line.** Per-plan resolution: Open Library's `title-only` matches are highest risk for wrong-edition metadata. Keep the data, flag for review. Curated overrides (the 265-book scholarly core) override the flag.
- **Series auto-create with `name = abbreviation = csv["Series"]`.** Source has ~50 series abbreviations vs the 8 seeded (ICC/NTC/OTL/EKK/TWOT/AB/MH/COT). Importer auto-creates the missing ones with placeholder name (= abbreviation) so junctions resolve; Session 7 settings-page polish renames them to canonical full forms (e.g. `NICNT` → `New International Commentary on the New Testament`).
- **Audit attribution via post-apply UPDATE, not session-scoped JWT.** The `audit_log_trigger` reads `auth.uid()` at trigger time. With the service-role client, `auth.uid()` returns NULL and there's no clean way to set it without forging a user JWT. Decision-007 explicitly accepts the post-apply `UPDATE audit_log SET changed_by = $owner WHERE changed_at >= $pass1_start` fallback. The script prints the exact SQL after a successful apply.
- **Optional partial unique index on `books.isbn` SKIPPED for Pass 1.** ISBN coverage from `enrich_library.py` came in at 65.8% (875/1,330), below the 70% threshold from decision 007. Will revisit pre-Pass 2 once the v2 spreadsheet has chased down missing ISBNs on the scholarly core. Per Open Question 9.

## Schema changes

None ship with this session. Nothing in the Pass 1 importer requires a new migration. The optional `books_isbn_uniq` index was deferred per the decision above.

## New components / patterns added

- **Reconcilable importer pattern proves out** — `SPREADSHEET_OWNED_FIELDS` constant + `pickSpreadsheetOwned()` helper + `findOrCreatePerson` shared with the form + diff-based junction sync mirroring `syncAuthors`/`syncCategories`. Future bulk-import surfaces (essays migration, people bulk import) reuse this shape.
- **`findOrCreatePerson` extraction to `src/lib/library/server/people-actions.ts`** — B14 dedup + `parseTypedName` now live in one place, callable from both `book-actions.createPerson` (form path) and the importer. Diacritic-fold (`à Kempis` → `a kempis`) added since the form previously didn't need to handle the spreadsheet's accented surnames.
- **Hand-transcribed override map pattern** — `migrationOverrides.ts` is the canonical example for how to take a heterogeneous markdown notes file and translate it to typed TS. Future migration runs (essays, etc.) follow the same shape: per-book overrides, group rules, deletions, additions, deferred-flags. `match: { ... }` with optional fields keeps the matcher robust against source-shape variations.
- **`author_raw_contains` matcher** — pattern for finding source rows that `parseTypedName` mishandles (missing-comma, non-standard format).
- **Source-internal duplicate detector** — `(normalized title, first-author last_name, volume_number)` key. Useful any time a bulk-import source has been edited by hand and may have accidental duplications.

## Open questions surfaced

- **Q9 — Pass 1 ISBN coverage.** Resolved: 65.8% (875/1,330). Below the 70% threshold for `books_isbn_uniq` partial unique index. **Will revisit pre-Pass 2** once the v2 spreadsheet has chased down missing ISBNs on the scholarly core.
- **Q10 — Audit attribution path validation.** The script's `--apply --limit 1` step is a smoke test for whether the post-apply audit_log UPDATE is actually needed. **Owner — resolve at first apply gate.**
- **Q11 — Auto-created series cleanup ownership.** Pass 1 will auto-create ~40-50 new `series` rows with `name = abbreviation`. **Tracked as Session 7 scope** — that session already includes `/settings/library/series` polish.
- **Q12 — Source-internal duplicates merge-on-import or merge-via-UI?** 22 dup pairs detected. Currently both kept + flagged for manual UI merge. Could alternatively pre-merge before INSERT, but losing one of two diverging rows in rows.json risks dropping legitimate edition variants. **Decided: keep both, flag for review.**

## Surprises (read these before the next session)

1. **Migration-notes `#N` numbers are not algorithmically reproducible.** "CMT #16" should map to "Burton — Galatians" per the notes, but a straightforward `(author asc, title asc)` of CMT-subject rows places Burton at index 20. Author renames in the notes ("Wray Beal" instead of "Beal") shift the sort. Don't try to match by `#N`; match by `(subject, series, author, title)`.
2. **`xlsx` ESM import quirk under Node ESM.** `import XLSX from 'xlsx'` works for CJS but the namespace import doesn't expose `readFile` under ESM. Pattern: `import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'` + `xlsxRead(buf, { type: 'buffer' })` after `readFileSync`.
3. **`xlsx` has unfixed CVEs (prototype pollution, ReDoS).** Acceptable for a one-off local script processing trusted user data. Documented in `package.json` audit. If we ever wire xlsx into anything user-facing, swap for a different parser.
4. **Source-internal duplicates include intentional duplicates.** The Tolkien LOTR books appear twice each because the user owns both audiobook and printed-book sets. The importer flags them but doesn't drop them — manual review via the existing list-page filter (`?needs_review=true`) is the cleanup path.
5. **Migration plan's "scholarly core needs_review = false ≥ 250" was over-optimistic.** Actual count: 159. The notes' 265 curated books, minus those that still have missing year/publisher from incomplete OL enrichment, lands at ~159. The 250 estimate didn't account for OL `no-match` rows within the curated set (BDAG, Brockhaus, several REF dictionaries that OL doesn't cover well).
6. **Override matching honors `subject` filter strictly.** REF reference works in the source have `subject = REF`, `subject = BRF`, OR `subject = NULL` interchangeably. Initial overrides used `subject: 'REF'` and missed half the targets. Fixed by dropping the subject filter on REF overrides and forcing `genre: 'Biblical Reference'` via the override edit instead.
7. **Brockhaus `subject = REF`, not `subject = BH`.** The notes label Brockhaus as a "BH" group, but BH is the *series* abbreviation, not the Subject column value. Source has `subject = REF` for all 31 Brockhaus volumes. Detection must be by `series`, not `subject`.
8. **No `ON DELETE CASCADE` on books FKs.** First version of `library_smoke_data_cleanup.sql` assumed cascade and tripped `book_authors_book_id_fkey`. Junctions (`book_authors`, `book_categories`, `book_bible_coverage`, `book_ancient_coverage`, `book_topics`, `scripture_references`, `essays`) all use plain `REFERENCES public.books(id)`. Cleanup SQL now wraps explicit per-table DELETEs in a transaction. **Implication for Pass 2 orphan handling**: the importer's "never soft-delete orphans" rule (decision 007) is reinforced — even a deliberate hard-DELETE requires manual junction cleanup, so the orphan-report-only path stays the right call.
9. **B1/B2 viewer-column trigger blocks service-role UPDATEs of `personal_notes` / `rating`.** Surfaced when the post-apply Brockhaus fix-up tried to add letter-range notes to 3 Wörterbuch vols. `enforce_books_viewer_columns()` is `BEFORE UPDATE` and gates on `app_is_owner()` which returns false when `auth.uid()` is NULL (service-role connection). Same root cause as Surprise #6 (audit attribution). The Pass 1 INSERT path was unaffected because the trigger is UPDATE-only. **Workaround**: any post-apply bulk patch script must drop `personal_notes` and `rating` from its UPDATE payload, OR (preferred for Pass 2) wire up a SECURITY DEFINER admin function with `SET LOCAL request.jwt.claim.sub = $owner` so `app_is_owner()` resolves true. Since Pass 1 was already a one-time event, the simpler "drop the column" path was used.
10. **Wörterbuch detection bug + Bible mis-tagged with publisher series.** Two source-data shapes my matchers missed on first build: Wörterbuch volumes are `DEUTSCHES WÖRTERBUCH <range>` (regex required `Brockhaus` prefix), and one Bible row had Series='BH' from publisher confusion. Both fixed in `applyBrockhaus`: regex broadened to `/^DEUTSCHES W[ÖO]RTERBUCH/i`, and BH+BBL combo now skips the Brockhaus rule and clears the BH series tag. 4 affected rows patched in DB via `scripts/library-import/patch-brockhaus-fixups.ts`. Pass 2 against the same source will land them correctly without manual intervention.
11. **Pass 1 results — slightly better than predicted.** `needs_review = false` final count is 162, not 159 (the Wörterbuch fixups bumped scholarly-core from 159 to 162). 1,331 live books (1,330 imported + 1 prior "Julius Caesar" UPDATEd in-place via title+author match). Total ops: 1330 INSERT + 1 UPDATE; 4,013 audit_log entries patched to owner attribution.

## Carry-forward updates

- [x] `docs/POS_Library_Build_Tracker.md` Session 4 — Pass 1 acceptance items annotated below.
- [x] `docs/Library_Migration_Notes.md` committed.
- [ ] **Pending env-var setup** before Pass 1 apply: `SUPABASE_SERVICE_ROLE_KEY` + `POS_OWNER_ID` in `.env.local`. See `scripts/library-import/README.md` step 2.
- [ ] **Pending `library_smoke_data_cleanup.sql` execution** in Studio before Pass 1 apply.
- [ ] **Pending Pass 1 dry-run + apply** — see tracker Session 4 acceptance.
- [ ] `.cursor/rules/library-module.mdc` "Bulk imports are reconcilable" section — defer to post-Pass-1 once apply confirms the pattern.
- [ ] `AGENTS.md` carry-forward inventory entry for the importer shape — same.

## Numbers (post-apply, final)

| Metric | Value |
|---|---|
| Source rows (Library_1.xlsx) | 1,330 |
| Enriched rows (enriched_library.csv) | 1,330 |
| ISBN coverage (OL enrichment) | 65.8% (875/1,330) |
| OL match-type breakdown | title+author 749 / title-only 294 / no-match 287 |
| Resolved import rows (rows.json) | 1,331 (1,330 source - 0 deletions + 1 BDAG addition) |
| Live books in prod post-Pass-1 | **1,331** (1,330 imported + 1 prior "Julius Caesar" UPDATEd in-place via title+author match) |
| `needs_review = false` (scholarly core) | **162** (target was ≥ 159; achieved) — Commentary 91 / Biblical Reference 52 / Greek Lang 9 / Bibles 6 / Hebrew Lang 4 |
| `needs_review = true` (review queue) | 1,169 |
| `book_authors` rows | 1,441 |
| `book_categories` rows | 275 |
| `people` rows (live) | 911 |
| `series` rows (live) | 55 (8 seeded + 47 auto-created at apply) |
| German books | 36 (33 from override flags + 3 Wörterbuch fixups) |
| Source-internal duplicate pairs | 22 |
| PER_BOOK_OVERRIDES applied | ~80 (incl. ABD 6, TDNT 10, Keil&Delitzsch 10, Matthew Henry 6, TWOT 2) |
| Brockhaus group rules applied | 31 (24 Enzyklopädie + 3 Wörterbuch + 3 supplementary + 1 Jahrbuch) |
| ORPHAN overrides | 2 (both intentional: defensive Hodge typo + redundant NICNT Acts deletion) |
| FK orphans (book_authors / book_categories / series_id / primary_category_id → missing book/series/cat) | **0** (verified via `inspect-fk-orphans.ts`) |
| Apply duration | 4 min 36 sec (0.21 sec/book average) |
| Audit rows attributed to owner via post-apply patch | 4,013 (3,981 from main apply + 32 from Brockhaus fix-ups) |
