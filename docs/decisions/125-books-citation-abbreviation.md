# 125 — Per-book citation abbreviation (series override)

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — follow-up to [124](124-dothb-essay-smoke-seed.md)

## Built

- `books.citation_abbreviation` (nullable text, trim 1–32 chars) — SBL/Turabian work abbr that **overrides** `series.abbreviation` when set
- Helper [`citation-abbreviation.ts`](../../src/lib/library/citation-abbreviation.ts): `effectiveSeriesAbbreviation` / `normalizeCitationAbbreviationOrNull`
- Loaders map view-model `series_abbreviation` to the **effective** value (formatters unchanged); `BookDetail.citation_abbreviation` exposes the raw override for the form
- Book form: optional “Citation abbreviation” field near Series
- Data: Historical Books back on **IVP Bible Dictionary Series** with `DOTHB`; siblings `DJG` / `DPL` / `DOTWPW`; soft-deleted one-off DOTHB series from [124](124-dothb-essay-smoke-seed.md)

## Decided

- Series = grouping/settings; citation abbreviation = per-work footnote label. ABD/TDNT/BDAG keep abbr on the series row (no book override). IVP Black Dictionaries share one series with distinct per-book abbrs.
- Bibliography stays full-title Covenant form (same as ABD fixture).
- **Owner smoke 2026-07-23:** keep compact first footnote (`in DOTHB, pages`); short form + bib signed off; no hybrid “DOTHB + eds/pub” first note.

## Schema changes

- `20260723162500_library_books_citation_abbreviation.sql`

## New components / patterns added

- `src/lib/library/citation-abbreviation.ts` + unit tests

## Open questions surfaced

- None blocking. Optional: seed essays on DJG/DPL/DOTWPW. IVP `publisher_location` backfill done ([127](127-ivp-publisher-location-backfill.md)). OCR matrix deferred until next scripture-batch change.

## Surprises

- Migration filename must sort **after** already-applied `20260723162000_…` (first draft used `61500` and would have inverted history).

## Carry-forward updates

- [x] AGENTS.md inventory
- [x] PLAN.md refreshed
- [x] `npm run supabase:gen-types`
- [x] components.mdc — BookForm notes citation abbr
- [x] `npm run check` + citation/format tests — 0 errors (2026-07-23)
