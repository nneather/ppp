# 007 — Reconcilable library import (Session 4 design lock)

**Date:** 2026-04-30
**Module:** library
**Tracker session:** Session 4 (pre-build design lock)

## Built

Nothing yet — this record locks the design BEFORE Session 4 is built so the import script ships reconcilable on day one rather than getting retrofitted after Pass 1 surfaces problems.

## Context

Session 4 was originally scoped as a one-shot `INSERT 1,288 books from CSV` pass with `idempotent via title + first-author dedup`. That ordering forced barcode-add (Session 6) to wait until after the migration to avoid duplicate rows.

User asked: _"Is it possible to move the barcode scanner above Session 4… or will there be a rewrite of data in the future regardless?"_

Conclusion after analysis: **the data-rewrite risk exists today even at current ordering** because the title + first-author dedup is brittle (title variants, author normalization differences) and a future "v2 spreadsheet pass" would either duplicate or clobber rows. The fix is not to move the scanner — it's to make the importer reconcilable so it can run twice safely.

User confirmed: _"If we can upload the scholarly core with the existing spreadsheet now then do a pass with an updated spreadsheet later (reconciling any discrepancies), I am okay with waiting to move the source of truth."_

This record captures the resulting design.

## Decided (non-obvious)

- **Two-pass workflow is the official Session 4 model.** Pass 1 lands ~1,288 books from the current spreadsheet now. Pass 2 lands the corrected v2 spreadsheet in early August. Both passes use the same script, same flags, same dry-run flow.
- **Match strategy is layered and ISBN-first.** Order: (1) `books.isbn = csv.isbn`, (2) `books.barcode = csv.barcode`, (3) normalized `(title, first-author last_name)` fallback (lower, strip leading "the/a/an", strip parenthesized suffixes, collapse whitespace), (4) no match → INSERT new. ISBN-first matters because `enrich_library.py` populates ISBN for both passes — making Pass 2 collision-proof for any book Open Library covers. The normalized-title fallback handles ISBN-less books (older commentaries, Bibles, BDAG).
- **`SPREADSHEET_OWNED_FIELDS` is a hard line.** The importer owns: `title`, `subtitle`, `publisher`, `publisher_location`, `year`, `edition`, `total_volumes`, `original_year`, `reprint_publisher`, `reprint_location`, `reprint_year`, `series_id`, `volume_number`, `genre`, `language`, `page_count`, `isbn`, `primary_category_id`, plus the `book_authors` / `book_categories` / `book_bible_coverage` junctions. Everything else is user-owned and never touched in update mode.
- **`needs_review_note` is a special case.** The auto-line ("Missing: title, year") may be refreshed on every pass; the user-authored portion is preserved using the same prepend-with-blank-line shape that `parseBookForm` already implements in `src/lib/library/server/book-actions.ts`. Reuse `computeMissingImportant` so importer + form stay aligned.
- **Junctions reconcile diff-based on Pass 2, not delete-and-reinsert.** Reuse the `syncAuthors` / `syncCategories` shape from `src/lib/library/server/book-actions.ts`. A book that gained a translator on the v2 spreadsheet should produce one new `book_authors` INSERT row in the audit log, not a delete-all + reinsert-all churn. Author role/sort_order changes UPDATE the existing junction row; categories follow the same diff/insert/delete pattern.
- **Importer NEVER soft-deletes books.** A book present on Pass 1's CSV but absent from Pass 2's gets written to a `library_import_orphans.csv` report file with `(id, title, first_author, last_seen_pass)`. Manual decision queue. The importer cannot know whether the absence is "I removed it from my library" or "I removed it from the spreadsheet but want to keep the row."
- **Dry-run is mandatory before every pass.** `--dry-run` emits a per-book diff report with four sections: INSERT (new books), UPDATE (matched + at least one spreadsheet-owned field would change, with old → new per field), NO-OP (matched + nothing changed), ORPHAN (in DB, not in CSV). Run it, eyeball it, then `--apply`. Same shape as `npm run supabase:db:push:dry`.
- **Audit attribution survives Pass 2.** Importer sets a session-scoped user context to `owner_id` so per-row UPDATE audit entries are attributable. The audit log UI already handles per-column diffs cleanly (Session 1.5 surfacing); Pass 2 will render as "owner UPDATE on books — title: X → Y, year: 2008 → 2009" etc.
- **Barcode-add (Session 6) stays post-migration.** Pre-Pass-1 scans would create thin rows that the Pass 1 importer would have to dedupe — possible but messy. Post-Pass-1 scans hit no spreadsheet match (genuinely new acquisitions) and just INSERT cleanly. The Pass 2 importer will dedupe them only if a corrected spreadsheet row matches by ISBN — which is the desired behavior anyway (replace thin scan metadata with curated metadata).
- **Optional partial unique index** on `books (isbn) WHERE isbn IS NOT NULL AND deleted_at IS NULL` is left to session-time judgement. Worth shipping if Pass 1 ISBN coverage is high (≥ 70% of scholarly core), since it hardens ISBN-collision into a constraint violation rather than a silent dedup miss. If coverage is patchy at Pass 1, defer until pre-Pass-2 cleanup so Pass 1 doesn't trip on legitimately-distinct rows that happen to share an ISBN typo.

## Field-ownership table (canonical reference)

This table is the authoritative source. Mirror it as the `SPREADSHEET_OWNED_FIELDS` constant in the import script and unit-test that nothing outside the spreadsheet column set gets touched in update mode.

| Column / table | Owner | Behavior on Pass N |
|---|---|---|
| `books.title` | spreadsheet | overwrite |
| `books.subtitle` | spreadsheet | overwrite |
| `books.publisher` | spreadsheet | overwrite |
| `books.publisher_location` | spreadsheet | overwrite |
| `books.year` | spreadsheet | overwrite |
| `books.edition` | spreadsheet | overwrite |
| `books.total_volumes` | spreadsheet | overwrite |
| `books.original_year` | spreadsheet | overwrite |
| `books.reprint_publisher` | spreadsheet | overwrite |
| `books.reprint_location` | spreadsheet | overwrite |
| `books.reprint_year` | spreadsheet | overwrite |
| `books.series_id` | spreadsheet | overwrite |
| `books.volume_number` | spreadsheet | overwrite |
| `books.genre` | spreadsheet | overwrite |
| `books.language` | spreadsheet | overwrite |
| `books.page_count` | spreadsheet | overwrite |
| `books.isbn` | spreadsheet | overwrite (only if CSV has a value; never NULL out an existing ISBN) |
| `books.barcode` | spreadsheet | overwrite (same NULL-preserve guard as isbn) |
| `books.primary_category_id` | spreadsheet | overwrite |
| `books.needs_review` | mixed | importer can flip to `true` based on missing fields; cannot flip a user-cleared `false` back to `true` without a CSV-explicit `needs_review = true` |
| `books.needs_review_note` | mixed | auto-line ("Missing: …") refreshed by importer; user-authored portion preserved per `parseBookForm` shape |
| `books.personal_notes` | user | never touched |
| `books.reading_status` | user | never touched |
| `books.rating` | user | never touched |
| `books.borrowed_to` | user | never touched |
| `books.shelving_location` | user | never touched |
| `books.deleted_at` | user | never touched (orphans go to report file, not soft-delete) |
| `books.created_at` | system | never touched |
| `books.created_by` | system | never touched (set on first INSERT only) |
| `book_authors` | spreadsheet | diff-based via `syncAuthors` shape |
| `book_categories` | spreadsheet | diff-based via `syncCategories` shape |
| `book_bible_coverage` | spreadsheet | diff-based (Session 5 ships this junction) |
| `scripture_references` | user | never touched |
| `book_topics` | user | never touched |
| `book_ancient_coverage` | user | never touched (Session 5 / 7) |

## Workflow this enables

```
NOW          → Session 4 Pass 1 with current spreadsheet
               (~1,288 books land, importer logs the IDs)
Pre-trip     → Sessions 5 + 6 (barcode-add for new acquisitions only)
Trip period  → Use the app. Edit reading_status, write personal_notes,
               capture scripture_references. The importer cannot touch any of these.
Early Aug    → Session 4 Pass 2 with v2 spreadsheet
               1. Dry-run, review diff
               2. Apply — only spreadsheet-owned fields update
               3. Orphan report tells you what to manually reconcile
Post-trip    → Sessions 7 → 9 → 8 as planned
```

The app is source of truth for everything user-authored from the moment Pass 1 lands. The spreadsheet remains source of truth for citation-grade metadata until Pass 2 ships, then the app takes over fully.

## Schema changes

None ship with this design lock. Session 4 may optionally add:

- `CREATE UNIQUE INDEX books_isbn_uniq ON public.books (isbn) WHERE isbn IS NOT NULL AND deleted_at IS NULL` — decide at session time based on Pass 1 ISBN coverage.

## New components / patterns added

- **Reconcilable importer pattern** — first formal write-up of "spreadsheet-owned vs user-owned fields with explicit Pass N model." Future bulk-import surfaces (e.g. essays migration when essays UI ships, or a `people` bulk import) should reuse the same shape: layered match strategy, owned-field constant, dry-run + diff, orphan report instead of soft-delete.
- **Rule update candidate** for `.cursor/rules/library-module.mdc`: add a "Bulk imports are reconcilable" section once Session 4 actually ships and the pattern proves out in practice. Defer the rule write-up until then to avoid documenting unproven shape.

## Open questions surfaced

- **Q8 — Pass 2 trigger** — when does the v2 spreadsheet get authored? Likely accumulates during the trip period via the no-subject review queue + reading-revealed corrections; authoritative v2 commit by early August so Pass 2 lands before Session 9 (OCR) and Session 8 (Turabian). Tracked as Open Question 8 in the build tracker.
- **Q9 — Pass 1 ISBN coverage** — what % of scholarly-core books does `enrich_library.py` actually return ISBNs for? Determines whether the optional partial unique index is worth shipping. Resolves during the pre-Session-4 enrichment run.

## Surprises (read these before the next session)

- **`enrich_library.py` runs once per pass.** Don't assume the Pass 1 ISBN coverage carries forward — re-run enrichment against the v2 CSV before Pass 2 to catch any ISBNs Open Library has added in the interim.
- **Pass 1's importer should write its own provenance.** Consider stamping `created_by = owner_id` AND adding a one-time `personal_notes` line like `[imported from scholarly-core spreadsheet v1, 2026-04-XX]` ONLY if `personal_notes` is currently empty. This is the only acceptable importer-write to a user-owned field, and only on first INSERT — never on Pass 2 UPDATE. **Easier alternative**: skip the provenance line; the audit log already records the import event with full attribution. Decide at session time.
- **Junction reconciliation must dedupe people the same way the form does.** B14 dedup (last_name + first_initial + middle_initial) lives in the form layer today; lifting it into a shared helper before Session 4 ships would prevent a parallel implementation. Candidate: extract `findOrCreatePerson({ last_name, first_name, middle_name? })` into `src/lib/library/server/people-actions.ts` (or extend `book-actions.ts`).
- **Pass 2 audit volume is unknown.** A worst-case v2 spreadsheet that touches every row produces ~1,288 UPDATE audit entries in one apply. The audit-log UI's pagination + module filter (Session 1.5) handles this fine, but expect a noisy day in `/settings/audit-log` on Pass 2 day.

## Carry-forward updates

- [x] Session 4 task list rewritten in `docs/POS_Library_Build_Tracker.md` with the 4-step match strategy, field-ownership block, dry-run + diff task, orphan report task, junction-diff task, and Pass 2 acceptance section.
- [x] Open Question 8 added to the build tracker.
- [x] Session 6 note added documenting the on-purpose post-migration ordering for barcode-add.
- [ ] `.cursor/rules/library-module.mdc` "Bulk imports are reconcilable" section — deferred to post-Session-4 when the pattern is proven.
- [ ] `AGENTS.md` carry-forward inventory entry for the importer shape — deferred to post-Session-4 for the same reason.
