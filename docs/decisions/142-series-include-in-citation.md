# 142 — Series `include_in_citation` flag

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — SSBT on Piotrowski *Return from Exile* was emitting abbr in notes; Covenant §17.1.5 treats series as optional for trade BT

## Built

- Migration `20260724193000_series_include_in_citation.sql`: `series.include_in_citation BOOLEAN NOT NULL DEFAULT true`; seeded **18** opt-outs (SSBT, NSBT, NSD, classics/fiction/popular multi-vol branding).
- `formatSeriesSegment` returns `''` when `series_include_in_citation === false` (flag only — **not** `volume_number`). Catalog `series_id` / name / abbr still hydrate for UI.
- Loaders hydrate `series_include_in_citation` on list/detail/review → `BookCitationInput` via `bookDetailToCitationInput` / `reviewCardToCitationInput`.
- `/settings/library/series`: Cite column + create/edit toggle; `series-settings-actions` persist the flag (absent FormData → default true for book-form inline create).
- Tests: SSBT-like omit; NSBT omit even with `volume_number`; WBC still cites with abbr-in-note.

## Decided

- Flag on **series** (not books). Default **TRUE** — commentary cites unchanged with zero backfill.
- Opt out trade/popular/fiction/classics + optional BT/dogmatics series (SSBT/NSBT/NSD).
- **Do not** use `volume_number` as include/omit signal (may be missing on cite-worthy rows; may be present on opted-out rows).
- Commentary-in-series behavior unchanged for opted-in series (WBC/NICNT/ESVEC/…).

## Schema changes

- `20260724193000_series_include_in_citation.sql` — column + seed opt-outs.

## New components / patterns added

- None (settings dialog checkbox on existing series page).

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Opted-out series with a non-null `volume_number` still can emit `Vol. N.` / `N:page` via multi-volume dispatch — flag only gates the **series segment**. True multi-vol sets (Churchill, Story of Civilization) still need volume in the cite; accidental series-enumeration volumes on SSBT-class rows are rare (Piotrowski has null).

## Carry-forward updates

- [x] components.mdc — N/A (no new component)
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [x] `npm run check` + `npm run test` (2026-07-24)
- [x] `npm run supabase:gen-types`
