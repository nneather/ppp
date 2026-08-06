# 197 — Invoicing analytics chart

**Date:** 2026-08-05
**Module:** invoicing
**Tracker session:** ad-hoc — hours/earnings over time

## Built
- `/invoicing/analytics` — time-entry hours + `hours × rate` bucketed by Chicago **week** (26) or **month** (12), ending today.
- Metric modes: **Hours | Money | Both** (dual-axis overlap when Both).
- Shared **Time | Invoices | Analytics** toggle on time, invoices, and analytics pages.
- Client filter (includes soft-deleted clients with series hours, e.g. FOL).
- Pure helpers + unit tests: `src/lib/invoicing/analytics.ts`.
- Hand-rolled SVG chart (no new chart dependency): `<InvoicingAnalyticsChart>`.

## Decided
- Peer analytics route (not a panel on the time list) — list already has day/week/month navigation.
- Measure **time entries**, not invoice status/paid cash.
- Default single-series toggle; **Both** as dual-axis option.
- Zero-fill empty buckets so the series is continuous.
- Soft-deleted clients stay visible in analytics when they have entries (historical FOL).

## Schema changes
- None

## New components / patterns added
- `src/lib/components/invoicing-view-toggle.svelte` — Time | Invoices | Analytics
- `src/lib/components/invoicing-analytics-chart.svelte` — SVG area/line + tooltip
- `src/lib/invoicing/analytics.ts` — bucket/range/URL helpers

## Open questions surfaced
- Invoice-status / cash-collected charts later if useful.
- Longer range controls (custom start/end) if 26w/12mo is too short for some views.

## Surprises (read these before the next session)
- Historical FOL + TWH imports ([196](196-invoicing-historical-fol-twh-hours.md)) already land as time entries, so analytics shows them without further DML.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] new env vars — n/a
- [ ] tracker Open Questions — n/a
