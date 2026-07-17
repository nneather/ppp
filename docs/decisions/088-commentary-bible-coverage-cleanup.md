# 088 — Commentary Bible coverage cleanup

**Date:** 2026-07-17
**Module:** library
**Tracker session:** Ad-hoc — commentary `book_bible_coverage` audit

## Built

- **Title-inferred bible coverage** for Commentary-genre books: **363** missing `book_bible_coverage` rows across **136** volumes (single-book + full multi-book ranges).
- **IVP Bible Background Commentary** (OT + NT) reclassified **Commentary → Biblical Reference**; left without coverage (whole-testament reference works).
- **New Interpreter’s Bible Vol X** — book-level coverage for Acts, Romans, 1 Corinthians; essays with authors:
  - Acts → M. Eugene Boring
  - Romans → N. T. Wright
  - 1 Corinthians → J. Paul Sampley
  - Plus matching essay-level `book_bible_coverage` rows.
- Post-apply: **203 / 211** commentaries have coverage; **8** intentionally untagged (5 thematic + 3 deuterocanonical).

## Decided

- Multi-book volumes (ranges, paired books, Calvin multi-book vols): assign **every** biblical book in the title range.
- IVP Background OT/NT: leave empty + genre **Biblical Reference**.
- Deuterocanonical Anchor vols (Judith, I–II Esdras, Ben Sira): leave without Protestant `bible_books` coverage for now.
- Thematic “commentaries” (Elijah & Elisha, Sermon on the Mount, Gospel According to the OT series, Gleanings from Elisha): leave untagged for now.
- NIB Vol X: assign Acts / Romans / 1 Corinthians and create essay owners per contributor notes.

## Schema changes

- None (DML only).
- `20260717180000_library_commentary_bible_coverage.sql` — coverage inserts + IVP genre + NIB essays/people.
- `20260717181000_library_nib_romans_essay_author_fix.sql` — fix N. T. Wright name (`middle_name` cleared) + attach Romans essay author.

## New components / patterns added

- None.

## Open questions surfaced

- Deuterocanonical coverage via `ancient_texts` later?
- Thematic volumes: tag host books when useful for passage search?
- Robert Wall’s NIB Vol X “Epistolary Literature” intro essay — not created (only the three book commentaries).

## Surprises (read these before the next session)

- Existing `people` row for Wright was `first_name = 'N.'`, `middle_name = 'T.'`; updating only `first_name` to `N. T.` broke the essay_authors JOIN that required empty middle name. Normalized to `first_name = 'N. T.'`, `middle_name = NULL`.
- MCP `execute_sql` remains read-only for writes; apply via `supabase db push`.

## Carry-forward updates

- [ ] components.mdc updated — N/A
- [ ] AGENTS.md inventory updated — N/A (no new helpers)
- [ ] new env vars documented — N/A
- [x] PLAN.md refreshed
