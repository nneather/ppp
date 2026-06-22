# 050 — Per-client invoice billing preferences

**Date:** 2026-06-22
**Module:** invoicing
**Tracker session:** ad hoc

## Built

- `clients.billing_cadence` (`weekly` | `monthly`) — default generate-invoice date range per payer.
- `clients.consultation_grouping` (`by_rate` | `weekly` | `monthly` | `per_entry`) — how logged hours roll into consultation line items.
- Settings UI on `/settings/invoicing` (client form + card summary).
- `buildConsultationLines()` in `src/lib/invoicing/consultation-lines.ts` with unit tests.
- Generate flow uses client settings instead of hardcoded client names.

## Decided

- **Two columns, not one** — billing cadence (period default) and consultation grouping (line rollup) are independent so a monthly invoice can still show weekly consultation lines (e.g. TWH multi-week reissue).
- **One-offs unchanged** — ad hoc lines from the generate form always stay separate; grouping applies only to time-entry-backed consultation hours.
- **Defaults preserve legacy behavior** — `monthly` + `by_rate` for existing clients; backfill sets TWH to `weekly`/`weekly` and Fountain of Life to `monthly`/`monthly`.
- **Removed name-based defaults** — `THIS_WEEK_HEALTH` / `FOUNTAIN_OF_LIFE` constants deleted from `generate-invoice-sheet.svelte`.

## Schema changes

- `supabase/migrations/20260622120000_clients_billing_preferences.sql` — columns + backfill.

## New components / patterns added

- `src/lib/invoicing/consultation-lines.ts` — pure grouping helper + label maps.
- `calendarMonthContainingYmd()` on `chicago-date.ts`.

## Open questions surfaced

None.

## Surprises (read these before the next session)

- Apply migration to hosted project before generate/settings will work in prod: `npm run supabase:db:push`.

## Carry-forward updates

- [ ] components.mdc updated — N/A
- [ ] AGENTS.md inventory updated — optional follow-up
- [ ] new env vars documented — N/A
- [ ] tracker Open Questions updated — N/A
