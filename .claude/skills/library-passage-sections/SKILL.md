---
name: library-passage-sections
description: >-
  Research and insert curated book_passage_sections for owned ppp library
  books (monograph chapters that treat one biblical passage at length). Use
  when Parker asks which books have passage sections, wants more "On this
  passage" rows, or names a treatise, sermon-on-the-mount book, or topical
  theology volume to section. Not for commentaries, scripture-index OCR, or
  adding books.
---

# Library — passage sections (research → edition-matched insert)

Curated rows on `book_passage_sections`. They power **On this passage** on `/library/search-passage` and study import ([249](../../docs/decisions/249-library-passage-sections.md), [251](../../docs/decisions/251-studies-passage-section-import.md)). Pattern: [250](../../docs/decisions/250-passage-sections-research-pass.md), [254](../../docs/decisions/254-passage-sections-wave-2.md).

Prod project: `objtrdmmqlndtfddtzan`. Data only — no migration. Inserts go through SQL so `compute_verse_abs()` and `write_audit_log()` fire. Set `created_by` to an existing section’s `created_by` (the owner).

## What qualifies

A chapter (or a whole short book) that expounds **one continuous passage**. Skip:

- Theology, history, or survey chapters with no single pericope (Carson *Showing the Spirit* ch. 5; Snodgrass intro).
- A Commentary that already covers the whole bible book **and** is actually a commentary on that whole book. A Sermon-on-the-Mount commentary is different: keep genre `Commentary`, delete the whole-book `book_bible_coverage` row, and add **one** section for the sermon (Guelich begins at Matt 4:23; Pennington and Augustine’s span is Matt 5:1–7:29). Do not split that book into pericopes. Coverage plus Commentary genre hides the section (`assignPassageBands`) and also lists the book for every chapter of Matthew.
- Essays. They stay the citation surface. A book-level section is only for search, and only when the essays are not themselves the passage units (*Women in the Church*).
- Sermon sets and multi-work volumes unless each item is one passage with its own pages.
- Page numbers from a different edition, a DBW volume, or a translation. If the shelf ISBN’s contents are not in hand, **do not insert**.

## Row shape

| Case | Rows |
|---|---|
| One chapter, one passage | One row. `page_end` is the page before the next contents entry. |
| One chapter, two passages (call narratives; a synoptic pair) | Two rows, **same pages**, different `bible_book`. |
| Synoptic parable told in two gospels | One row per gospel, shared pages (Snodgrass). |
| A part that is already one range (Sermon on the Mount = Matt 5–7) | Keep the block. Add other passages in the same book; do not also file every subsection. |
| A book that is itself the Sermon on the Mount | One row for the whole sermon. Guelich is Matt 4:23–7:29. |

`label` is the chapter title (≤ 200). Verses from the chapter’s own epigraph or the contents line, not from a guess about “the usual text.” `page_start` / `page_end` are text. Chapter-only ranges leave `verse_start` / `verse_end` null.

Idempotent insert: skip a live row with the same `book_id`, `label`, `bible_book`, and `page_start`.

## Research order

1. SQL: book id, ISBN, year, publisher, genre, existing sections, coverage, essays.
2. Contents for **that ISBN**. Prefer publisher or Google Books contents, LOC, or a sample PDF whose copyright page matches the ISBN.
3. Map each contents line to a verse range from the chapter heading or the opening quotation in the same translation.
4. Insert, then `SELECT` the new rows (`verse_*_abs` should be `chapter * 1000 + verse`) and confirm an `audit_log` INSERT.
5. File `docs/decisions/NNN-*.md` and refresh PLAN.md. List anything held for a missing contents page.

## Held on purpose (do not backfill from another edition)

- *Nachfolge*, Brunnen ISBN 9783765509483 (Zimmerling, 320 pp.). Kaiser 1952, Kaiser 1985, and DBW 4 paginate differently.
- Eastman, *Paul and the Person*. Chapters are Romans 7, Philippians 2, Galatians 2; chapter-start pages were not published in a contents list. Catalog `year` / `isbn` are null.
