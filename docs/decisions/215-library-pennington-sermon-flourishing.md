# 215 — Library Pennington Sermon on the Mount shelf add

**Date:** 2026-08-27
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260827185800_library_pennington_sermon_flourishing.sql` (hosted push):
  - **New person:** Jonathan T. Pennington (`middle_name` `T.`).
  - **Standalone:** *The Sermon on the Mount and Human Flourishing* (`subtitle` A Theological Commentary), Baker Academic 2018 paperback `9781540960641`, `original_year` 2017.
  - Genre **Commentary**; `reading_status` reference; `needs_review` false.
  - **Coverage verified:** `Matthew`.
  - **Passage:** Matthew 5–7 chapter range (`verse_start_abs` 5000–7999), pages 1–352 (catalog span, not TOC-verified).

## Decided
- Paperback **2018** barcode, not the 2017 hardcover `9780801049637`.
- Commentary (not Gospels and Jesus), matching Guelich’s Sermon sibling + the book’s subtitle.
- Book-level **Matthew** coverage *and* a Matt 5–7 `scripture_references` row so `/library/search-passage` hits it. Owner may rework this dual tagging later.
- `needs_review = false`.

## Schema changes
- `20260827185800_library_pennington_sermon_flourishing.sql` — DML only

## New components / patterns added
- None. First add-books batch to INSERT a catalog-level `scripture_references` locator (whole-book pages + chapter range).

## Open questions surfaced
- Whether Commentary coverage should stay whole-book (`Matthew`) vs passage-only for section commentaries. Owner flagged a possible later rework.

## Surprises (read these before the next session)
- `page_start` is NOT NULL on `scripture_references`; used catalog page count 352 as `1`–`352` rather than leaving pages blank.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
