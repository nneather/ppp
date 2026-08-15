# 201 — Invoicing analytics range + first-class one-offs

**Date:** 2026-08-15
**Module:** invoicing
**Tracker session:** ad-hoc — analytics date range + one-off charges on hours view

## Built
- `/invoicing/analytics` date range presets: **YTD** (default), 12 months, 26 weeks, All, Custom (`from`/`to` URL params). Bucket guard (>104 weeks / >36 months).
- First-class **one-off charges** on `/invoicing` via Hours | One-off segmented sheet (description + amount; ledger `hours=1`, `rate=amount`, `is_one_off=true`). Unbilled one-offs editable/deletable; list shows `$` not `Nh × $`.
- Invoice **generate** splits existing unbilled one-offs out of consultation rollup; form one-offs still allowed as extras. Preview excludes one-off qty from hours.
- Invoice **discard** unlinks all linked `time_entries` (including one-offs) instead of soft-deleting one-offs.
- Analytics: money includes one-offs; hours exclude them; summary caption when one-off money > 0.
- `invoicing_unbilled_counts()` returns `hours` + `amount`; hours-page Unbilled badges show `$`.

## Decided
- Reuse `time_entries.is_one_off` (no new table) — ledger stays balanced before invoice ([000](000-invoicing-retro.md)).
- Hours-sheet one-offs are always qty=1 + amount; generate sheet keeps qty × unit price for last-minute lines.
- Discard restores one-offs to unbilled (same as hours) — discarded draft must not erase a dinner charge.
- Default analytics range is **YTD**, not the old fixed 26w/12mo window.

## Schema changes
- `20260815173032_invoicing_unbilled_counts_amount.sql` — DROP + recreate `invoicing_unbilled_counts()` with `hours` + `amount` columns.

## New components / patterns added
- `src/lib/invoicing/one-off.ts` — parse/amount/ledger helpers shared by hours actions + generate.
- `firstOfYearThroughYmd` in `chicago-date.ts`.
- Analytics range helpers in `analytics.ts` (`resolveAnalyticsRange`, presets, bucket limit).
- `<TimeEntrySheet>` Hours | One-off mode (create); edit locks kind from row.

## Open questions surfaced
- Cash-collected / invoice-status charts still deferred ([197](197-invoicing-analytics.md)).
- FOL/TWH invoice reconstruction still deferred ([196](196-invoicing-historical-fol-twh-hours.md)).

## Surprises (read these before the next session)
- `CREATE OR REPLACE FUNCTION` cannot widen `RETURNS TABLE` — must `DROP FUNCTION` first.
- Host-local `periodBounds` on `/invoicing` was replaced with Chicago UTC-noon helpers so week/month match analytics.

## Carry-forward updates
- [x] components.mdc updated (time-entry-sheet blurb)
- [x] AGENTS.md inventory — one-off + analytics helpers
- [x] PLAN.md refreshed
- [ ] new env vars — n/a
- [x] tracker post-build row
