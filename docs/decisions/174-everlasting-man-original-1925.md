# 174 — Everlasting Man original publication 1925

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (original publication data)

## Built
- Migration `20260725004700_library_everlasting_man_original_1925.sql` (applied hosted):
  - *The Everlasting Man* (Chesterton, `88b84212-…`) → `original_year=1925`, `reprint_publisher='Image Books'`, `reprint_location='Garden City, NY'`, `reprint_year=1974`
  - Shelf-edition main fields unchanged (Image Books / Garden City, NY / 1974 / ISBN 0385071981)

## Decided
- Model as full Turabian reprint (Barth Römerbrief fixture shape: main fields = shelf edition, `reprint_*` set explicitly) — not `original_year` alone as in [168](168-cost-of-discipleship-scribner-1995.md), because the ask was citation-facing original-publication info. Citations now render `(1925; repr., Garden City, NY: Image Books, 1974)` / bib `1925. Reprint, …, 1974.`
- Original publisher **name** (first published London: Hodder & Stoughton, 1925) has no schema field and Turabian reprint form does not cite it — recorded in the migration comment + here only. No new column for one book.
- No publishers-registry rows created (book uses free-text publisher; Image Books/Hodder not in registry) — consistent with the row's existing state.

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None (existing `formatPublicationFacts` reprint path + book-detail Reprint row cover it)

## Open questions surfaced
- None

## Surprises (read these before the next session)
- No live book had used the full `reprint_*` field set until now — only fixtures did ([167](167-nachfolge-brunnen-2016.md)/[168](168-cost-of-discipleship-scribner-1995.md) set `original_year` alone as inventory metadata). This is the first row exercising the Turabian reprint format in prod.

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A (DML only)
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
