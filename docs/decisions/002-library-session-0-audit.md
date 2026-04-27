# 002 — Library Session 0 audit

**Date:** 2026-04-25
**Module:** library
**Tracker session:** Session 0

## Built

- Promoted `POS_Library_Build_Tracker_1.md` into the repo at [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md). The trip-reframed plan (6 pre-trip + 3 post-trip sessions) is canonical from this point forward.
- Drafted [`supabase/seed/library_seed.sql`](../../supabase/seed/library_seed.sql) — bible_books (66), ancient_texts (Josephus / Philo / Apostolic Fathers / Apocrypha), series (ICC / NTC / OTL / EKK / TWOT / AB / MH / COT). Idempotent. Categories list and viewer `user_permissions` row are placeholders pending Round 2 decisions.
- Verified `_LIBRARY_TABLES` whitelist in [`src/routes/settings/audit-log/+page.server.ts`](../../src/routes/settings/audit-log/+page.server.ts) already covers all 12 library tables; `STRIP_FIELDS` already covers `verse_*_abs`. No changes required to the audit-log UI to start exercising library writes.
- Confirmed RLS, `compute_verse_abs`, and `write_audit_log` are all already present in [`supabase/migrations/00000000000000_baseline.sql`](../../supabase/migrations/00000000000000_baseline.sql). No "Session 0 baseline migration" needed — the schema audit reveals only additive deltas, captured in the proposed-delta table below.
- Schema-delta migration **not** queued yet. The proposed delta is enumerated below; the `library_delta_v1.sql` file gets written in the same commit Round 2 confirms the final scope.

## Decided (non-obvious)

- **Tracker_1 supersedes the older tracker.** The older `POS_Library_Build_Tracker.md` (April 23) was the source of the schema delta + per-entity Open Question resolutions; Tracker_1 (April 25) is the trip-reframed sequence (5a–5d locked, Session 1 = vertical slice with junctions, Session 2 builds `<SourcePicker>` + overlap SQL function, Session 5 layers topics/coverage on top). We carry forward the older tracker's *content* (delta rows + Open Question resolutions) into this audit doc; the *plan* is Tracker_1.
- **Seed file location.** `supabase/seed/library_seed.sql` (folder created by this commit). Repo had no prior `supabase/seed/`. The supabase config disables the local Docker `[db.seed]` path, so this file is run manually against prod via `psql` or the Studio SQL editor — **not** via `supabase db push` and **not** via `supabase db reset`. Documented in the seed file header.
- **Seed idempotency.** Every INSERT uses `ON CONFLICT DO NOTHING` against the natural key (`bible_books.name`, `ancient_texts.canonical_name`, `series.name + abbreviation`). Re-running the seed is safe.
- **Categories deferred.** The schema doc says "7 canonical shelving categories" but does not enumerate them. Round 2 names them. Until then the categories block is a commented placeholder; the seed file is still applicable to bible_books / ancient_texts / series in the meantime.
- **Viewer seed deferred.** The viewer's `user_permissions` row needs a real `auth.users.id`. Round 2 captures the UUID; the seed file has the row template commented out with `<viewer_uuid>` until then. Tracker_1 Session 1 acceptance includes "viewer can / cannot do X" tests, so the viewer must exist before Session 1 closes — but it does not need to exist before Session 1 *starts*.
- **Schema-delta migration is staged separately.** Per Round 1, migrations are written but not pushed. The `library_delta_v1.sql` file gets written after Round 2 picks the column set; user reviews `npm run supabase:db:push:dry`, then runs the apply manually.

## Schema audit pass

Each library table verified against [`supabase/migrations/00000000000000_baseline.sql`](../../supabase/migrations/00000000000000_baseline.sql) and [`src/lib/types/database.ts`](../../src/lib/types/database.ts) (last regenerated 2026-04-23 per the auth-trigger migration).

| Table                   | Baseline ✓ | DB types ✓ | RLS helper ✓ | Library-workflow gaps                                                                                                                          |
| ----------------------- | :--------: | :--------: | :----------: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `bible_books`           |     ✓      |     ✓      |   N/A (SELECT-all)   | None — seeded this session with the 66-book Protestant canon.                                                                          |
| `ancient_texts`         |     ✓      |     ✓      |     ✓        | Seed list of Josephus/Philo/Apostolic Fathers/Apocrypha shipped this session. Category vocabulary kept free text (A8 deferred).                |
| `people`                |     ✓      |     ✓      |     ✓        | **Add** `aliases TEXT[]`, `middle_name TEXT`, `suffix TEXT` for fuzzy match + Turabian author formatting. See proposed delta.                  |
| `series`                |     ✓      |     ✓      |     ✓        | Seed of 8 series shipped this session. Editor-of-series field deferred (no real-world need yet).                                               |
| `categories`            |     ✓      |     ✓      |   N/A (SELECT-all)   | **Round 2 blocker** — names of the 7 shelving categories not yet captured. Seed row template ready; values pending.                    |
| `books`                 |     ✓      |     ✓      |     ✓        | **Add** `needs_review_note TEXT`, `page_count INT`, and `'french'` to the `language` CHECK. See proposed delta + B1/B2 enforcement question.   |
| `book_authors`          |     ✓      |     ✓      |     ✓        | Role enum already includes `'translator'` per baseline. Older tracker's "add translator role" item is stale — no schema change needed.         |
| `book_categories`       |     ✓      |     ✓      |     ✓        | Primary lives on `books.primary_category_id`; this junction holds extras. Confirmed.                                                           |
| `book_bible_coverage`   |     ✓      |     ✓      |     ✓        | UNIQUE constraints present (book_id+bible_book and essay_id+bible_book). Polymorphic CHECK present.                                            |
| `book_ancient_coverage` |     ✓      |     ✓      |     ✓        | No UNIQUE constraint (cf. `book_bible_coverage`). Intentional: a book can engage one ancient text in multiple distinct ways across its argument. |
| `essays`                |     ✓      |     ✓      |     ✓        | UI deferred per E1; data model intact. No app-layer creation path in pre-trip arc.                                                             |
| `essay_authors`         |     ✓      |     ✓      |     ✓        | Role enum locked to `'author'`. Sufficient.                                                                                                     |
| `scripture_references`  |     ✓      |     ✓      |     ✓        | `confidence_score` populated only by OCR (deferred per 5a). `source_image_url` storage bucket name pending Open Question 3 (resolve at S2).    |
| `book_topics`           |     ✓      |     ✓      |     ✓        | CHECK enforces `lower(trim(topic))`. Topic synonyms deferred (T4). Trigram autocomplete shipped at Session 5 with `<CanonicalizingCombobox>`.   |

## Decision points 5a–5d (locked per Tracker_1)

- **5a OCR pipeline:** **OUT** for pre-trip. Schema hooks (`source_image_url`, `confidence_score`, `needs_review`, `review_note`) remain. Manual entry only via `<ScriptureReferenceForm>` in Session 2. Ingest pipeline deferred to post-trip Session 9 (optional) or later.
- **5b ancient_texts canonicalization:** **BOTH** — seed canonical list in this Session 0 (Josephus/Philo/Apostolic Fathers/Apocrypha); inline `<CanonicalizingCombobox>` lands in Session 5; Settings CRUD page (with merge) lands in post-trip Session 7.
- **5c component naming:** `<SourcePicker>` for the polymorphic `(book_id OR essay_id)` shape (used by `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`). `<CanonicalizingCombobox>` for the `ancient_texts.canonical_name + abbreviations[]` and `book_topics.topic` autocomplete patterns. Names will be added to [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc) when the components ship.
- **5d Session 1 scope:** books CRUD + people junctions + categories + series — full vertical slice with junctions, not books-alone. The older tracker's books-alone Session 1 is superseded by Tracker_1.

## Per-entity Open Question resolutions

Carried forward from the older tracker (April 23). Format: ✓ resolved, ☐ open, ☐ deferred. Open items only need attention before the named session.

### `books` (14 questions)

| #   | Question                                                                                                                          | Status                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Can viewer edit `personal_notes`?                                                                                                 | ✓ **No.** Shipped in Session 1.5: trigger `enforce_books_viewer_columns` ([`20260425170000_books_viewer_column_protection.sql`](../../supabase/migrations/20260425170000_books_viewer_column_protection.sql)) + app-layer strip in `updateBookAction`.       |
| B2  | Can viewer edit `rating` (1–5)?                                                                                                   | ✓ **No.** Same trigger + strip as B1.                                                                                                                                              |
| B3  | Can viewer edit `reading_status`?                                                                                                 | ✓ **Yes.** Collaborative read state.                                                                                                                                                |
| B4  | Can viewer soft-delete books?                                                                                                     | ✓ **No.** Per RLS summary. Only owner deletes.                                                                                                                                      |
| B5  | Dedup on create: ISBN match? title+first-author match? both?                                                                      | ✓ **ISBN exact → hard-block.** Title+first-author fuzzy → warn with "Similar book exists: …" confirm-to-continue.                                                                   |
| B6  | If two book records are merged (future dedup tooling), cascade of `scripture_references` and `book_topics`?                       | ☐ **Open — post-August.** When merge tool ships, both tables re-point via `UPDATE ... SET book_id = <canonical>`.                                                                  |
| B7  | Trigger conditions for `needs_review = true` on import                                                                            | ✓ **Resolved.** True when: author field contains raw xlsx string with multiple authors not yet split, OR genre is NULL, OR citation-required field (publisher/year) is NULL.        |
| B8  | Auto-set `reading_status = 'reference'` for genre in (Commentary, Biblical Reference, language tools)?                            | ✓ **No.** Keep explicit — mark references deliberately.                                                                                                                             |
| B9  | Can viewer clear `needs_review = true`?                                                                                           | ✓ **Yes.** Collaborative review is the whole point.                                                                                                                                 |
| B10 | When a book is soft-deleted, what happens to its `book_authors` / `book_categories` rows?                                          | ✓ **Nothing.** Junctions don't have `deleted_at`. JOIN-filter on `books.deleted_at IS NULL` hides orphans.                                                                          |
| B11 | Editing `primary_category_id` — ripple into `book_categories` junction?                                                           | ✓ **Yes.** When primary changes, INSERT into `book_categories` if not already there. Never remove junction rows on primary change.                                                  |
| B12 | Borrowed-out (`borrowed_to IS NOT NULL`) — warn on edit?                                                                          | ✓ **No warning.** Borrow state is independent of metadata edits.                                                                                                                    |
| B13 | Multi-volume set where only some volumes owned                                                                                    | ✓ **One book row per owned volume.** `series_id` + `volume_number` populated. No "set completeness" field.                                                                          |
| B14 | Two "J. Smith" authors in `people` — dedup prompt when creating second?                                                            | ✓ **Yes.** Last-name + first-initial match → `<CanonicalizingCombobox>` per `library-module.mdc`: "Person exists: J. Smith (3 books). Use existing or create new?"                  |

### `essays` (10 questions)

_Essays UI deferred post-fall per Tracker_1 PostBuild #1. These resolutions plan the data model for when the UI ships._

| #   | Question                                                                                              | Status                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Essays UI deferred — does essays schema get exercised at all in pre-trip arc?                          | ✓ **No.** Read-only path. UI returns 0 rows. `essay` branch of `<SourcePicker>` is stubbed disabled in Session 2.                                  |
| E2  | Can `scripture_references.essay_id` be populated pre-trip?                                            | ✓ **No path to create** — no essays exist.                                                                                                         |
| E3  | ESVEC vol 1 contributors' scripture references — stored on parent book or on essays?                  | ✓ **On parent book pre-trip.** Migrate to essays when UI ships.                                                                                    |
| E4  | Viewer permissions on essays when UI ships                                                            | ☐ **Open — pre-Session-N when essays UI is scoped.** Default to same as books (SELECT + INSERT + UPDATE, no DELETE).                              |
| E5  | Dedup: two essays with same title under same parent_book                                              | ☐ **Open — pre-Session-N.** Warn + confirm, mirror books B5.                                                                                       |
| E6  | Essay `page_start` — within-volume page number, not within-essay                                       | ✓ **Within-volume.** Consistent with `scripture_references.page_start` on parent book.                                                             |
| E7  | If parent book is soft-deleted, cascade to essays?                                                    | ✓ **No automatic cascade.** Essays have own `deleted_at`. JOIN-filter.                                                                              |
| E8  | Essay author autocomplete reuses `people` + `book_authors`-style junction                              | ✓ **Yes.** `essay_authors` junction in schema. Same autocomplete component.                                                                         |
| E9  | Essays with independent bible / ancient coverage vs. inheriting from parent book                       | ✓ **Independent.** `book_bible_coverage` and `book_ancient_coverage` already accept `essay_id`.                                                     |
| E10 | One essay in multiple books (reprinted in festschrift)                                                | ☐ **Open — schema blocker.** `essays.parent_book_id` is NOT NULL singular. Revisit only if a real case emerges.                                    |

### `scripture_references` (12 questions)

| #   | Question                                                                                              | Status                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Viewer edit any reference or only their own (`created_by = auth.uid()`)?                              | ✓ **Only their own.** Mirror invoicing pattern. RLS UPDATE policy gets `(created_by = auth.uid())` predicate; layer on `app_is_viewer_writer`.       |
| S2  | Viewer DELETE?                                                                                        | ✓ **No.** Per RLS summary.                                                                                                                            |
| S3  | Dedup: same book + same passage + same page → block or allow?                                          | ✓ **Allow duplicates.** Legitimate re-discussion possible. UI shows existing refs as cue.                                                             |
| S4  | Overlap query boundary inclusivity (Phil 2:1–11 search Phil 2:11)                                     | ✓ **Yes.** Inclusive on both ends. Per `verse_end_abs >= :search_start`.                                                                              |
| S5  | Chapter-level ref (verse_start NULL, abs = 0) vs verse-level search — match?                          | ✓ **Yes.** Trigger stores abs = chapter*1000 + 0. Overlap matches.                                                                                    |
| S6  | Whole-book ref (chapter_start NULL) vs verse search — match?                                          | ✓ **Yes.** Trigger stores abs = 0 / 999999. Matches all searches on that bible_book.                                                                  |
| S7  | `confidence_score` UI treatment — render differently for manual (NULL) vs OCR entries?                | ✓ **Yes.** Manual = no badge; OCR = confidence % badge, sorted after manual in search results.                                                        |
| S8  | `source_image_url` — private Supabase Storage bucket; signed URLs on read?                            | ✓ **Yes.** Private bucket, signed URL with 1h TTL. Bucket name pending pre-Session-2 (Open Question 3 in Tracker_1).                                  |
| S9  | Cross-bible-book refs on one page (Rom 8 ↔ Phil 2 discussed together)                                  | ✓ **Two separate rows.** Schema is one bible_book per row.                                                                                            |
| S10 | `needs_review` auto-set on OCR when confidence < threshold                                            | ✓ **OCR deferred** (5a / Session 9). When OCR ships, threshold = 0.80.                                                                                |
| S11 | When book soft-deleted, scripture_refs with that book_id — also hidden?                               | ✓ **Yes via JOIN filter.**                                                                                                                            |
| S12 | Edit `book_id` on an existing ref?                                                                    | ✓ **Disallow via UI.** If wrong, delete and recreate. Keeps audit log clean.                                                                          |

### `book_topics` (11 questions)

| #   | Question                                                                       | Status                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Topic autocomplete case-insensitive match against existing                     | ✓ **Yes.** CHECK constraint already enforces `lower(trim())`.                                                                                            |
| T2  | Typo detection: "chrisology" vs existing "christology"                         | ✓ **Trigram similarity warn.** If `similarity(new, existing) > 0.7` and new topic has < 3 uses, warn "Did you mean 'christology'?"                       |
| T3  | Dedup: same book + topic + page — block?                                       | ✓ **Allow.** Same reasoning as S3.                                                                                                                       |
| T4  | Topic synonyms layer                                                           | ✓ **Deferred** (PostBuild). Autocomplete prevents new fragmentation meanwhile.                                                                            |
| T5  | Viewer edit any topic or only their own?                                        | ✓ **Only their own.** Mirror S1.                                                                                                                          |
| T6  | Viewer INSERT topics                                                            | ✓ **Yes.** Per RLS summary.                                                                                                                              |
| T7  | Viewer DELETE topics                                                            | ✓ **No.** Per RLS.                                                                                                                                       |
| T8  | Orphan topic cleanup                                                            | ✓ **N/A.** No separate topics table — topic text lives on each row.                                                                                       |
| T9  | Rename a topic globally                                                         | ☐ **Deferred.** Requires UPDATE across many rows + audit log transaction. Post-fall via SQL console if needed.                                            |
| T10 | `source_image_url` same rules as S8                                             | ✓ **Yes.**                                                                                                                                                |
| T11 | When book soft-deleted, topics hidden via JOIN filter                          | ✓ **Yes.** Same pattern as S11.                                                                                                                          |

### `ancient_texts` (11 questions)

| #   | Question                                                                                       | Status                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Merge two canonical entries UX                                                                 | ✓ **Warning modal:** "This will re-point N book_ancient_coverage rows and cannot be reverted." Require typing canonical name to confirm. (Post-trip Session 7.)                       |
| A2  | Viewer can CREATE ancient_texts?                                                                | ✓ **No.** Per RLS (SELECT only for viewer). Owner-only — prevents canonical pollution. Inline create in Session 5 combobox is owner-only.                                              |
| A3  | Viewer can edit abbreviations array?                                                            | ✓ **No.**                                                                                                                                                                              |
| A4  | Fuzzy-match threshold for "Did you mean X?"                                                    | ✓ **Trigram similarity > 0.6 on canonical_name, OR exact case-insensitive match against abbreviations[]**. Surfaced through `<CanonicalizingCombobox>`.                                 |
| A5  | Abbreviation collisions across entries (e.g. "Philo" matches both Philo and Pseudo-Philo)       | ✓ **Allow.** UI surfaces all matches; user picks.                                                                                                                                       |
| A6  | On merge, re-point `book_ancient_coverage.ancient_text_id`                                      | ✓ **Single transaction.** UPDATE coverage, soft-delete merged-away row, audit_log entry with `revertible = false`.                                                                      |
| A7  | Merge audit log structure                                                                       | ✓ **Single entry:** `operation = 'UPDATE'`, `old_data` = merged-away row, `new_data` = canonical row, `revertible = false`, plus N audit rows for re-pointed coverage entries.          |
| A8  | `category` field free text — normalize to enum?                                                 | ☐ **Deferred.** Keep free text for August; enum if >10 distinct values emerge.                                                                                                          |
| A9  | Delete an ancient_text with coverage entries — allow?                                           | ✓ **Block.** Require merge-into-another or detach-from-all-coverage first. FK has no ON DELETE — enforce in app.                                                                        |
| A10 | Undo merge — reverse the re-pointing?                                                           | ✓ **No.** Non-revertible flag on audit log. Warning in merge modal.                                                                                                                     |
| A11 | Citation integration: Turabian cites `canonical_name` verbatim                                  | ✓ **Yes.** Format stored matches citation format.                                                                                                                                       |

### Still-open questions surface (≤2 per major entity)

- **books:** B1/B2 enforcement strategy (Round 2). B6 merge cascade (post-fall).
- **essays:** E4 viewer permissions, E5 dedup, E10 reprinted-in-festschrift schema blocker — all blocked on essays UI session.
- **scripture_references:** none open per-entity. (Storage-bucket name is a global Tracker_1 Open Question, not per-entity.)
- **book_topics:** T9 global rename (deferred to SQL console).
- **ancient_texts:** A8 category normalization (deferred until > 10 distinct values).
- **people:** still-open list ≤ 2 — see Round 2 questions for `aliases` / `middle_name` / `suffix` delta confirmation.
- **series:** none.

## Proposed schema delta (`library_delta_v1.sql`) — pending Round 2 confirmation

The following migration is *proposed*. The file is **not** yet written to `supabase/migrations/`. Round 2 picks one of three scopes (full / minimal / middle); the file is then drafted, dry-run reviewed, and applied by the user.

| UI need                                                                          | Table.column                          | Current                                                       | Action                                                                                          | Migration SQL                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review-flag explanation on `books`                                                | `books.needs_review_note TEXT`        | missing — boolean exists, no note (cf. `scripture_references`) | **Add.** Without it, viewer clearing a flag has no context.                                     | `ALTER TABLE books ADD COLUMN IF NOT EXISTS needs_review_note TEXT;`                                                                                                                                                                                                                |
| Total page count from Open Library enrichment                                     | `books.page_count INT`                | missing                                                       | **Add.** Useful for essay pagination sanity + reading progress.                                 | `ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count INT;`                                                                                                                                                                                                                        |
| French-language texts (Joüon, possible Calvin French, possible Barth French)      | `books.language` CHECK                 | enum: english, greek, hebrew, latin, german, chinese, other   | **Add 'french'.** Under-specified enum forces misclassification to 'other'.                     | `ALTER TABLE books DROP CONSTRAINT books_language_check, ADD CONSTRAINT books_language_check CHECK (language IN ('english','greek','hebrew','latin','german','french','chinese','other'));`                                                                                       |
| People with name aliases (C. S. Lewis / Clive Staples Lewis; Futado/Futato)       | `people.aliases TEXT[]`               | missing                                                       | **Add.** Direct analogue of `clients.email TEXT[]`. Reuses `<EmailChipsEditor>` (chips-editor). | `ALTER TABLE people ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';`                                                                                                                                                                                                 |
| People with suffixes / compound last names (Jr., III, Wray Beal)                  | `people.suffix TEXT`                  | missing                                                       | **Add.** Turabian "Smith, John, Jr." otherwise pollutes last_name.                              | `ALTER TABLE people ADD COLUMN IF NOT EXISTS suffix TEXT;`                                                                                                                                                                                                                          |
| People with middle initials (F. F. Bruce, C. S. Lewis, R. Laird Harris)           | `people.middle_name TEXT`             | absorbed into first_name                                      | **Add.** Keeps first_name atomic for alphabetization.                                           | `ALTER TABLE people ADD COLUMN IF NOT EXISTS middle_name TEXT;`                                                                                                                                                                                                                     |
| Audit-log non-revertibility for people merge                                      | `write_audit_log()` body              | exists; only invoices have status-transition handling          | **Update.** Mirror ancient_texts merge — set `revertible = false` on people merge UPDATE.       | Update `write_audit_log()` to set `v_revertible := false` when `TG_TABLE_NAME = 'people'` and the UPDATE is part of a merge transaction (signalled by `set_config('app.merge_in_progress', 'true', true)` from the merge action). Implementation lands when post-trip merge ships. |
| Translator role on `book_authors`                                                 | `book_authors.role` CHECK             | already includes 'translator'                                  | **No action.** Older tracker stale — reclassify as data migration in post-trip Session 7.       | None.                                                                                                                                                                                                                                                                               |
| Structured shelving (room → bookshelf → shelf)                                    | `books.shelving_location`             | free TEXT                                                     | **Keep free text.** Single-home library; structured is right long-term but not now.             | None.                                                                                                                                                                                                                                                                               |
| ISBN multi-value per work                                                         | `books.isbn`                          | single TEXT                                                   | **Keep single.** One physical copy ≈ one ISBN. Multi-edition owned = two book rows.             | None.                                                                                                                                                                                                                                                                               |
| `is_reprint` boolean                                                              | `books.is_reprint`                    | derivable from `reprint_year IS NOT NULL`                      | **Don't add.** Derivable. Add as `GENERATED ALWAYS AS ... STORED` only if filter perf matters.   | None.                                                                                                                                                                                                                                                                               |

**Round 2 picks a scope:**

- **Full delta:** all six ALTERs above (books × 3, people × 3) + audit-log-trigger update queued for post-trip Session 7.
- **Middle delta:** books × 3 (notes + page_count + french). People deltas deferred to pre-Session-7.
- **Minimal delta:** books × 2 (notes + page_count). Skip french. People deltas all deferred.

## Carry-forward inventory check

Walked the [`AGENTS.md`](../../AGENTS.md) inventory against every library surface planned in pre-trip Sessions 1–6:

| Need                                            | Use                                                                                                                                                              | Status   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Auth gate                                        | `locals.safeGetSession()`                                                                                                                                       | ✓ exists |
| Form action result discriminator                 | `{ kind, success?, message?, <id>? }`                                                                                                                           | ✓ exists |
| Owner check                                      | `app_is_owner()` + server-side profiles re-fetch                                                                                                                | ✓ exists |
| Viewer-with-write check                          | `app_is_viewer_writer('library')` already in baseline RLS for books / scripture_references / book_topics / people / series / book_authors / book_categories / coverage tables | ✓ exists |
| Soft delete                                      | `deleted_at TIMESTAMPTZ`, `IS NULL` filter                                                                                                                      | ✓ exists |
| Audit logging                                   | `write_audit_log()` trigger attached to all library tables                                                                                                       | ✓ exists |
| Multi-value text input                          | `<EmailChipsEditor>` (will be reused for `people.aliases` and `ancient_texts.abbreviations[]`)                                                                  | ✓ exists |
| Destructive confirm                             | `<ConfirmDialog>`                                                                                                                                                | ✓ exists |
| Entity form in sheet                            | `<ClientFormSheet>` pattern → copy + adapt for `<BookFormSheet>` in Session 1                                                                                   | ✓ pattern |
| Single sheet for create + edit                  | `<TimeEntrySheet>` pattern (`entity == null` ⇒ create)                                                                                                          | ✓ pattern |
| Audit log row + revert                          | `<AuditRow>` + `_REVERTIBLE_TABLES` whitelist; library tables intentionally excluded                                                                            | ✓ exists |
| Polymorphic source picker                       | `<SourcePicker>` — **to build** in Session 2                                                                                                                     | ☐ Session 2 |
| Canonicalizing combobox                         | `<CanonicalizingCombobox>` — **to build** in Session 5                                                                                                          | ☐ Session 5 |
| Scripture overlap SQL function                   | `search_scripture_refs(p_bible_book TEXT, p_chapter INT, p_verse INT)` — **to build** in Session 2                                                              | ☐ Session 2 |
| Open Library enrichment script                   | `enrich_library.py` — external prereq, lives outside repo                                                                                                       | ☐ pre-S4 |
| `@zxing/browser` barcode lib                     | npm install pending                                                                                                                                              | ☐ pre-S6 |

No invoicing-era gaps found — every Session 1 surface has a carry-forward to lean on.

## Schema changes

None this session. Schema delta proposed (table above), not yet queued. Round 2 picks scope; the migration file follows.

## New components / patterns added

None this session. Session 1 will add `<BookFormSheet>` and update [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc).

## Open questions surfaced

- **Round 2 (this build round):** viewer UUID, delta scope, categories names, genres list, B1/B2 enforcement strategy, `<BookFormSheet>` field grouping + junctions-now-or-later, soft-delete UX, decision-record slug for Session 1 close.
- **Pre-Session 2:** Storage bucket name + RLS shape for `source_image_url` (Tracker_1 Open Question 3).
- **Pre-Session 4:** subject-vs-genre terminology reconciliation in `Library_Migration_Notes.md` (Tracker_1 Open Question 6); Open Library API rate limits across full 1,288 enrichment (Tracker_1 Open Question 2).
- **Pre-Session 6:** `@zxing/browser` 30-min phone spike (Tracker_1 Open Question 1).

## Surprises (read these before Session 1)

1. **The library schema is already complete in the baseline.** Every table, RLS policy, audit trigger, and the `compute_verse_abs` trigger are all in `00000000000000_baseline.sql`. The "Session 0 migration" the older tracker imagined is purely additive (the proposed delta) — there is no schema-shape rewrite to do.
2. **`_LIBRARY_TABLES` is already wired into the audit-log UI.** Session 1 writes will appear under the "Library" filter at `/settings/audit-log` immediately. No follow-up audit-log changes are needed for Session 1's books surface.
3. **`STRIP_FIELDS` already contains `verse_start_abs` and `verse_end_abs`.** The audit revert path is future-safe for library, even though library tables are intentionally excluded from `_REVERTIBLE_TABLES` per [`docs/decisions/001-audit-log-ui.md`](001-audit-log-ui.md).
4. **`supabase/seed/` did not exist.** The seed file landing this session creates the directory. The supabase config disables the local Docker `[db.seed]` path (no local stack), so the file is run manually against prod via Studio SQL editor or `psql` — **not** via `supabase db push`.
5. **`book_authors.role` already includes `'translator'`.** The older tracker had a "add translator role" delta row — that was stale. The actual post-trip task is a *data migration* (move translator names from `personal_notes` into structured `book_authors` rows), not a schema change.

## Carry-forward updates

- [x] `docs/POS_Library_Build_Tracker.md` exists in repo (Tracker_1 promoted from Downloads).
- [x] `docs/decisions/002-library-session-0-audit.md` filed (this file).
- [x] `supabase/seed/library_seed.sql` filed with bible_books / ancient_texts / series; categories + viewer pending Round 2.
- [ ] `library_delta_v1.sql` queued — pending Round 2 scope.
- [ ] Viewer `user_permissions` row inserted — pending Round 2 UUID.
- [x] `_LIBRARY_TABLES` whitelist confirmed sufficient in `/settings/audit-log/+page.server.ts`.
- [ ] `.cursor/rules/components.mdc` updated for `<BookFormSheet>` — Session 1 deliverable.
- [ ] `AGENTS.md` inventory updated for new library patterns — Session 1 deliverable.
- [x] No new env vars introduced.
