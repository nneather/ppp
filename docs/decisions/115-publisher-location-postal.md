# 115 — Publisher location postal US states

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — writing-session copy row showed `Grand Rapids, Mich`

## Built

- Extended [`publisher-location.ts`](../../src/lib/library/publisher-location.ts): traditional bibliographic state abbreviations (`Mich.`, `Ill.`, `N.J.`, …) and full names → **postal** (`MI`, `IL`, `NJ`).
- Normalize on **read** (loaders, `publisherEffectiveLocation`, Turabian `formatPublicationFacts`, writing-session `copyPublisherYearLine`) so existing rows display correctly without a data migration.
- Normalize on **write** (book create/update/review + publisher `default_location`) so new/edited rows store postal form.

## Decided

- Always postal for US states in citations and copy UI — never traditional Chicago abbreviations or spelled-out state names.
- Display-time normalize is enough for legacy data; no one-shot SQL cleanup this session (next book save also rewrites the column).

## Schema changes

- None.

## New components / patterns added

- `resolveUsStatePostal` / `normalizePublisherLocationOrNull` on the existing location helper.

## Open questions surfaced

- None.

## Surprises

- OL/proposal paths already called `normalizePublisherLocationTurabian`, but the map only knew full state names — `Mich` passed through unchanged.
- Decision **114** already used for book-detail UI cleanup in a parallel session — this entry is **115**.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] AGENTS.md inventory note updated
- [x] `npm run test` + `npm run check` — 281 tests, 0 errors
