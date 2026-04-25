# Personal Operations System — Library Module: Session 0 (Prep)

_Last updated: April 25, 2026 | Module: Library (2nd) | Target: post-invoicing | Status: not started_

This document is the entry point for the **first** library build session. It is intentionally NOT a per-session tracker — that gets drafted at the **end** of Session 0 once the schema audit and Open Questions are resolved. Trying to draft a tracker before this work is done is what bit invoicing (see retro item #2).

---

## How to read this doc

Required prereads, in order:

1. [`AGENTS.md`](../AGENTS.md) — session-start template, carry-forward inventory, decision-log location.
2. [`docs/decisions/000-invoicing-retro.md`](decisions/000-invoicing-retro.md) — schema gaps, RLS surprises, and component patterns from invoicing. **Read this twice.** It exists specifically so library doesn't repeat invoicing's mistakes.
3. [`docs/decisions/001-audit-log-ui.md`](decisions/001-audit-log-ui.md) — most recent session; relevant because the audit-log UI's `_LIBRARY_TABLES` whitelist will need updates as new tables ship.
4. [`docs/POS_Schema_v1.md`](POS_Schema_v1.md) — finalized schema. Library tables are in the "Library" section.
5. [`.cursor/rules/library-module.mdc`](../.cursor/rules/library-module.mdc) — library-specific conventions (polymorphic FKs, viewer-write, search-first).
6. [`.cursor/rules/components.mdc`](../.cursor/rules/components.mdc) — reusable components from invoicing.

Then read this doc.

---

## Session 0 acceptance

Session 0 is **complete** when all of the following are true:

- [ ] Schema audit pass below is signed off (every table confirmed against `00000000000000_baseline.sql` + `database.ts`; gaps captured as Open Questions or migrations queued).
- [ ] Open Questions list driven down to **≤2 unresolved per major entity**. The rest are explicitly resolved or explicitly deferred with a target session.
- [ ] Viewer user is seeded in production with the required `user_permissions` row(s); a curl smoke test proves the viewer can write `books` and cannot DELETE.
- [ ] Decision points in section 5 below are all resolved (in/out of scope, naming, OCR yes/no).
- [ ] **Then and only then**, draft `docs/POS_Library_Build_Tracker.md` modelled on the invoicing tracker.

Do not start Session 1 (first vertical slice — likely "books CRUD + people junctions") until the tracker exists and the user has reviewed it.

---

## 1. Schema audit pass

For each library table below, verify three things:

1. The DDL is present in [`supabase/migrations/00000000000000_baseline.sql`](../supabase/migrations/00000000000000_baseline.sql).
2. The corresponding `Row` / `Insert` / `Update` shapes exist in [`src/lib/types/database.ts`](../src/lib/types/database.ts) (regenerate with `npm run supabase:gen-types` first if you've touched migrations).
3. RLS policy uses `app_is_owner()` + `app_is_viewer_writer('library')` helpers (per [`db-changes.mdc`](../.cursor/rules/db-changes.mdc)). Direct `EXISTS (SELECT FROM profiles ...)` policies will silently fail on cross-table writes — see retro surprise #1.

Then read each table with **library workflows in mind** (search, attribution, ingest) and flag fields that are missing. Invoicing surfaced `clients.address_line_1/2` as a gap during Session 5, not Session 1; do that work upfront here instead.

| Table                   | Baseline ✓ | DB types ✓ | RLS helper ✓ | Library-workflow gaps to flag (write into Open Questions) |
| ----------------------- | :--------: | :--------: | :----------: | --------------------------------------------------------- |
| `bible_books`           |            |            |              | Seed completeness; sort_order alignment with canonical order. |
| `ancient_texts`         |            |            |              | Need a "loeb_volume" or canonical-edition link for cross-references? Categorization vocabulary. |
| `people`                |            |            |              | `display_name` override (for "F. F. Bruce" vs "Bruce, Frederick Fyvie"); birth/death years for disambiguation. |
| `series`                |            |            |              | Editor-of-series field? Volume number scheme — integer vs free text? |
| `categories`            |            |            |              | Seed list (the "7 canonical shelving categories") — confirm names + sort. |
| `books`                 |            |            |              | ISBN-10 vs ISBN-13 — store both? Normalize? `acquired_at`, `cover_image_url`, `library_of_congress_number`, `dewey_decimal`. Multi-binding (hardback/paperback) edition tracking. Loan tracking beyond `borrowed_to`. |
| `book_authors`          |            |            |              | Role enum: `'author' \| 'editor' \| 'translator'` — covers contributors-of-essays-in-edited-volumes? |
| `book_categories`       |            |            |              | Just primary in `books.primary_category_id` + extras here? Confirm. |
| `book_bible_coverage`   |            |            |              | Verse-level vs whole-book — currently only `bible_book` granularity. Sufficient? |
| `book_ancient_coverage` |            |            |              | UNIQUE constraint missing (compare to `book_bible_coverage`)? Intentional? |
| `essays`                |            |            |              | No author junction visible until `essay_authors` ships; ensure essay UI is a Session-N decision, not built ad-hoc. |
| `essay_authors`         |            |            |              | Role enum locked to `'author'` only — good (no editors of essays). |
| `scripture_references`  |            |            |              | `confidence_score` semantics — set by what? OCR pipeline only? Manual entries leave it null. `source_image_url` storage bucket name + RLS on bucket. |
| `book_topics`           |            |            |              | Topic vocabulary — autocomplete-only or seed list? `topic_synonyms` deferred per schema doc. |

Surfaced gaps go into Open Questions (section 3) and either:

- get fixed in a Session 0 migration (small additive columns); or
- get explicitly deferred to a later session with a documented owner and target date.

---

## 2. Carry-forward from invoicing — what NOT to rebuild

Use these. They are battle-tested.

| Need                                | Use                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Auth gate in `+page.server.ts`      | `locals.safeGetSession()` (see [`sveltekit-routes.mdc`](../.cursor/rules/sveltekit-routes.mdc)) |
| Form-action result discriminator    | `{ kind, success?, message?, <entityId>? }`                                               |
| Owner check in actions              | `app_is_owner()` (DB) + re-fetch `profiles.role` (server, defense-in-depth)               |
| Viewer-with-write check             | `app_is_viewer_writer('library')` in RLS policies                                          |
| Soft delete                         | `deleted_at TIMESTAMPTZ`, filtered by `IS NULL` in queries                                |
| Audit logging                       | `write_audit_log()` trigger — already attached to all library tables                      |
| Multi-value text input              | `<EmailChipsEditor>` (works for any `text[]` column — `abbreviations`, e.g.)              |
| Destructive confirm                 | `<ConfirmDialog>`                                                                         |
| Entity form in sheet                | `<ClientFormSheet>` pattern — copy and adapt for `<BookFormSheet>`                        |
| Single sheet for create + edit      | `<TimeEntrySheet>` pattern (`entity == null` = create mode)                               |
| Audit log row + revert              | `<AuditRow>` + `_REVERTIBLE_TABLES` whitelist in `/settings/audit-log/+page.server.ts`    |

---

## 3. Open Questions (≥10 per major entity)

Drive these down to ≤2 per entity before declaring Session 0 done. The starter set below is the **minimum**; add to each list as the schema audit surfaces more.

### books

1. ISBN — store ISBN-10 and ISBN-13 separately, or one column with normalization?
2. Multi-volume sets — separate `books` rows (one per volume) or one row with `total_volumes`? If one row, how is per-volume reading status tracked?
3. Reprints — display primarily by `original_year` or `reprint_year` on the spine label?
4. `volume_number` is free text. UI input — text field with a "common values" hint (Roman numerals, "2b"), or stricter validation?
5. `borrowed_to` is free text. Promote to a structured `loans` table now or after first lender disagreement?
6. Genre + language enums — manage as Settings page surface or hardcoded in `src/lib/types/library.ts`?
7. Cover photos / spine photos — schema column (`cover_image_url`), Storage bucket name, RLS shape?
8. Acquisition tracking — `acquired_at`, `acquired_from` (gift / used / new), purchase price?
9. Search defaults — title-only first, or all-fields fuzzy (title, subtitle, authors, series)?
10. "Currently reading" surface — derived from `reading_status = 'in_progress'` only, or a separate "active reading list" feature?

### essays

1. UI surface — included in book detail page, or separate `/library/essays` route?
2. Page numbering — re-use `books.year`-style INT, or text to handle Roman/prefixed (`xiv`, `IV.317`)?
3. Multi-author essays — `essay_authors` supports it; UI wants a person picker or freeform?
4. Essays with no `parent_book_id` — schema requires NOT NULL. What about freestanding essays / journal articles? Defer to post-August?
5. Essay deletion — cascade to `essay_authors`, `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`? Confirm CASCADE behavior on each.
6. Essay editing — when `essay_title` changes, do we surface "this essay was retitled" in the audit log diff prominently?
7. Essay-level reading status — currently only on `books`. Need it for essays too?
8. Essay ingest — manual entry only, or paste-list-of-essays bulk action?
9. Fuzzy match on essay title at create time (like `ancient_texts.canonical_name`)?
10. "Essays in this book" view — sort by `page_start` or by entered order?

### scripture_references

1. **OCR yes / no for MVP?** — explicit decision required per [`library-module.mdc`](../.cursor/rules/library-module.mdc). If yes, design Edge Function + storage bucket + `needs_review` queue UI. If no, manual entry only and `source_image_url` stays unused.
2. `confidence_score` only set by OCR pipeline — null on manual entry?
3. `needs_review` UI — top-level filter chip on `/library/scripture` or only via a dedicated review queue page?
4. Range entry — chapter-only (`Phil 2`), verse-range across chapters (`Phil 2:1–3:11`), open-ended (`Phil 2:1–end`). Supported in schema; UI input shape?
5. Overlap query — should it default to overlap or exact-match? Per schema, overlap. Confirm UX.
6. Audit-flagged "verses_abs invariant broken" — does the `compute_verse_abs` trigger have any failure modes the user should see?
7. Source image — expire? Retain forever? Storage cost.
8. Bulk delete from a single book — supported? Audit consequences.
9. Cross-book overlap surfacing — when user searches "Phil 2:1–11", group hits by book or interleave?
10. `review_note` UI — single-line vs multiline; show in row vs require expand?

### book_topics

1. Topic vocabulary — entirely user-driven via autocomplete, or seeded with a starter list (e.g. theological loci)?
2. `topic_synonyms` table is deferred per schema doc — confirm "deferred" still means "post-August" and is acceptable for first user.
3. CHECK constraint enforces `lower(trim(topic))` — UI normalizes silently or validates and warns?
4. Page range vs single page — `page_end` nullable; when does UI default to "single page"?
5. Topic merge UX — if user realizes "atonement" and "Atonement" are duplicates after the fact, how is the merge done? Audit revert implications?
6. Filtering by `needs_review` — same as scripture_references?
7. Topic autocomplete data source — distinct values from `book_topics.topic`? Cached or queried live?
8. Topic deletion — soft-delete on row; what about the orphan topic name itself?
9. Cross-essay vs cross-book topic surfacing — same query path?
10. OCR overlap with `scripture_references` — does OCR populate both, or topics are always manual?

### ancient_texts

1. Categories — fixed enum (`Josephus`, `Apostolic Fathers`, `Apocrypha`, `Philo`, ...) or open string?
2. Where does the canonicalization UI live — Settings → Library → Ancient Texts (CRUD page) or inline at scripture-reference-creation time as a "Did you mean X?" prompt?
3. Abbreviations — `text[]` column. Edit UI uses `<EmailChipsEditor>` pattern; are there abbreviation conventions to enforce?
4. Merging two canonical entries — `revertible = false` per schema. UI warns; what does the merge action actually do at SQL level (UPDATE all FKs from src → dst, then soft-delete src)?
5. Seed list — confirm contents (Josephus *Antiquities* + *Jewish War*, Philo, Apostolic Fathers list, Apocrypha books).
6. Display format — `canonical_name` is "Josephus, Antiquities". Display always like that, or strip the author prefix in some views?
7. Versioning — old vs new editions of, say, the *Apostolic Fathers* texts. Track at this layer or at the citation layer?
8. Author of an ancient text — modeled how? `people` row + a junction, or just bake into `canonical_name`?
9. Search — fuzzy match against `canonical_name` and any `abbreviations[]` element. Library UX confirms this is the only entry point?
10. Audit consequences — INSERTs are routine; merges are not. UI distinguishes them in the log?

### people

1. Display name — algorithmic (`last_name, first_name`) or explicit `display_name` column override?
2. Birth/death years for disambiguation — needed at MVP or post-August?
3. Multi-language names — Greek / Hebrew / Latin author names; one row with multiple `name_*` cols, or one row per language?
4. Author merge — same as ancient_texts merge (UPDATE all junctions, soft-delete the loser). Audit consequences identical?
5. Editor / translator-only people — currently distinguished by `book_authors.role`. Sufficient?
6. Pseudonyms — separate row + a "alias_of" pointer, or single row with notes?
7. Where does the people CRUD live — Settings → Library → People, or inline-create at book-form?
8. RLS — `Full` for owner and viewer per schema. Confirm "viewer can create authors" is intentional.
9. People deletion — what blocks it? Active books? Active essays?
10. Search — fuzzy match across `first_name + last_name`? Reused for inline autocomplete in book form?

### series

1. Abbreviation — UNIQUE? (Schema doesn't enforce.) Real-world WBC/NICNT/OTL conflicts in the wild?
2. Editor-of-series — store who edits the series? Or just ignore until needed?
3. Volume numbering scheme per series — some series use integers, some use Roman, some use letter suffixes (`2b`). UI input shape?
4. Series CRUD UI — Settings → Library → Series page, or inline-create at book-form?
5. "Series I own most of" report — derived from `books.series_id` count? Useful tile?
6. Series deletion — same `books`-blocked pattern as `clients` in invoicing?
7. RLS write — viewer can create new series. Confirm intentional.
8. Series + reprint — does the original volume vs reprint volume share `series_id`? Yes per schema; UX implications?
9. Series search — fuzzy match against `name` and `abbreviation` both?
10. Display — full name, abbreviation, or both, in the book card / row?

---

## 4. Viewer seeding plan

Per [`library-module.mdc`](../.cursor/rules/library-module.mdc): viewer write access on library tables is non-trivial and **every library session must include a "viewer can / cannot do X" acceptance line**. Set this up in Session 0 so it's done before Session 1's first acceptance test.

Steps:

1. **Create a viewer auth user** — Supabase Dashboard → Authentication → Users → Add user. Use a real email (you'll receive the confirm email). Note the UUID.
2. **Insert a `profiles` row** for the viewer with `role = 'viewer'`. The `auth_user_profile_trigger` migration ([`20260423120000_auth_user_profile_trigger.sql`](../supabase/migrations/20260423120000_auth_user_profile_trigger.sql)) does this automatically; just verify.
3. **Insert a `user_permissions` row** for `library` write access:

   ```sql
   INSERT INTO public.user_permissions (user_id, module, access_level)
   VALUES ('<viewer-uuid>', 'library', 'write');
   ```

4. **Verify with curl** (anon JWT for the viewer):

   ```bash
   # Should succeed — viewer-write on books
   curl -X POST "$PUBLIC_SUPABASE_URL/rest/v1/books" \
     -H "apikey: $VIEWER_JWT" -H "Authorization: Bearer $VIEWER_JWT" \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","primary_category_id":"<cat-uuid>","genre":"theology","language":"english"}'

   # Should fail — viewers cannot DELETE
   curl -X DELETE "$PUBLIC_SUPABASE_URL/rest/v1/books?id=eq.<id>" \
     -H "apikey: $VIEWER_JWT" -H "Authorization: Bearer $VIEWER_JWT"
   ```

5. Document the viewer email + UUID in your local notes (do **not** commit the JWT). The viewer doesn't need invoicing access (no `user_permissions` row for `'invoicing'` means no access).

---

## 5. Decision points to lock before Session 1

These are explicit decisions, not Open Questions. The next agent should resolve each one with the user before starting Session 1.

### 5a. OCR pipeline — in or out for MVP

Per [`library-module.mdc`](../.cursor/rules/library-module.mdc): "Decide explicitly per session". The `scripture_references` table has `source_image_url`, `confidence_score`, `needs_review`, `review_note` columns clearly anticipating image ingest. Two valid paths:

- **In**: Edge Function for OCR (Tesseract via Deno or external API), Storage bucket for images, staging rows with `needs_review = true`, queue UI. ~2 sessions of work.
- **Out**: Columns stay nullable. Manual entry only via a `<ScriptureReferenceForm>`. Defer image ingest to post-MVP. ~0 incremental work.

Recommendation: **out** for MVP unless image-driven entry is the actual user motivation. Manual entry is simpler and lets the search UX (the actual primary verb) ship sooner.

### 5b. Ancient text canonicalization — settings page or inline

Two surfaces compete:

- **Settings page**: Settings → Library → Ancient Texts. CRUD UI, abbreviation editor, merge action. User curates the vocabulary upfront.
- **Inline**: At scripture-reference-creation time, a `<CanonicalizingCombobox>` shows fuzzy matches and a "Create new ancient text X" callback. User curates as they go.

Recommendation: **both** — seed the canonical list (Josephus, Philo, Apostolic Fathers, Apocrypha) before Session 1, then add inline create-as-you-go via the combobox. The Settings page can ship in a later session.

### 5c. Component naming

Per [`library-module.mdc`](../.cursor/rules/library-module.mdc):

- One `<SourcePicker>` for the polymorphic `(book_id OR essay_id)` choice. Used by `scripture_references`, `book_topics`, `book_bible_coverage`, `book_ancient_coverage`. **Do not** invent four versions.
- One `<CanonicalizingCombobox>` for the `ancient_texts.canonical_name + abbreviations[]` and `book_topics.topic` autocomplete patterns.

Confirm names before implementation so the rule doc doesn't drift.

### 5d. First vertical slice for Session 1

Library is search-first, not CRUD-first (per [`library-module.mdc`](../.cursor/rules/library-module.mdc): "A working search UI on seed data should land by Session 2 or 3"). Session 1 candidates:

- **Books CRUD + people junctions** — analogous to invoicing Session 2. Builds the vertical for entering data.
- **Scripture overlap search on seed data** — analogous to invoicing Session 3 (which built generation on seed entries). Would land the search UX first; data entry follows.

Recommendation: **books CRUD + people**, but explicitly pair Session 2 with the search UX so search isn't deferred.

---

## 6. After Session 0 — drafting the tracker

When Session 0 acceptance is met, draft `docs/POS_Library_Build_Tracker.md` modelled on [`docs/POS_Invoicing_Build_Tracker.md`](POS_Invoicing_Build_Tracker.md). Suggested session arc (subject to revision based on Open Question resolutions):

1. **Session 1**: Books CRUD + people junctions. Settings → Library → Series + Categories seed surfaces.
2. **Session 2**: Scripture-references CRUD + scripture overlap search UI on seed data.
3. **Session 3**: Topics + ancient_texts canonicalization (combobox + Settings page).
4. **Session 4**: Essays + book_bible_coverage + book_ancient_coverage UIs.
5. **Session 5**: OCR pipeline (if 5a → in) OR polish + dashboard wiring (if 5a → out).
6. **Session 6**: Audit-log integration smoke test (extends `_LIBRARY_TABLES`); viewer acceptance pass.

Acceptance per session must include:
- One "viewer can do X" line.
- One "owner can do Y, viewer cannot" line.
- Schema-audit-driven gaps closed or explicitly punted.

---

## Notes

- Library is structurally different from invoicing in three ways: polymorphic FKs everywhere (`book_id` OR `essay_id`), viewer has write access, and search is the primary verb (not generation). Don't accidentally apply invoicing's CRUD-list defaults.
- The audit log UI shipped in Session 6 of invoicing already handles library writes once those tables get used — verify by setting the module filter to "Library" after Session 1 lands.
- `npm run supabase:gen-types` regenerates `src/lib/types/database.ts`. Run after every migration, commit the result alongside the migration.
- The Cursor hook in `.cursor/hooks.json` warns if a migration changes without regenerating types.
