# 127 — IVP publisher_location backfill

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — follow-up to [124](124-dothb-essay-smoke-seed.md) / [125](125-books-citation-abbreviation.md)

## Built

- Idempotent DML migration `20260723162832_library_ivp_publisher_location_backfill.sql` (hosted `db push`):
  - Linked live **IVP** / **IVP Academic** books → `publisher_location = 'Downers Grove, IL'` (postal form; also normalized `Downers Grove, Ill` / bare `Downers Grove`)
  - High-confidence unlinked free-text → `publisher_id` + same location: `IVP Academic`, `InterVarsity Press`, `IVP Books%`, `IVP Connect`
  - Seeded **B&H Academic** (`Nashville, TN`); fixed *2 Corinthians* (was mis-linked to IVP Academic)
  - *Creation Regained* → **Eerdmans** / `Grand Rapids, MI` (ISBN `9780802800435`; free-text had been `Inter-Varsity`)
- Confirmed `book-actions` already normalizes location on write via `normalizePublisherLocationOrNull` ([115](115-publisher-location-postal.md)) — no app code change

## Decided

- Target string is always postal **`Downers Grove, IL`** (not Ill. / Illinois / city alone).
- Exclude UK-ish **`Inter-Varsity*`** free-text from the IVP location/link pass; only *Creation Regained* was remapped (clear Eerdmans ISBN). Left *1 & 2 Samuel* (`Inter-Varsity Missions`) unlinked as-is.
- Create **B&H Academic** publisher when fixing the mislink rather than leaving `publisher_id` null — matches free-text already used on EGGNT rows.

## Schema changes

- `20260723162832_library_ivp_publisher_location_backfill.sql` — DML only (+ one publishers INSERT if missing)

## New components / patterns added

- None.

## Open questions surfaced

- ~~Optional later: link remaining ~25 B&H / Broadman / Holman free-text rows to `B&H Academic`~~ — **done** ([131](131-bh-publisher-link-backfill.md)); single imprint, no Broadman Press split.
- *1 & 2 Samuel* (`Inter-Varsity Missions`, ISBN `9781844743681`) still unlinked; location already `Downers Grove, IL` — may be UK IVP imprint (verify on shelf).

## Surprises

- Post-apply IVP-ish inventory: **50** live rows with `Downers Grove, IL`, **0** NULL (includes already-correct + newly linked; excludes B&H / Eerdmans outliers).
- MCP / dry-run still the right path; migration filename after `20260723162500_…`.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars documented — N/A
- [x] `npm run check` — 0 errors (2026-07-23)
