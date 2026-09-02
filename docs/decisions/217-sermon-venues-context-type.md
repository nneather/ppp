# 217 — Sermon venue location type auto-fills context

**Date:** 2026-09-02
**Module:** sermons
**Tracker session:** Ad-hoc (venue type default)

## Built

- `sermon_venues.context_type` (`church` | `parachurch` | `academic`, nullable) — same C/P/A taxonomy as `sermons.context_type`.
- Backfill from live sermons: majority type per venue. All 9 venues were homogeneous, so this is a straight copy (5 church, 2 parachurch, 2 academic).
- New-sermon Sheet: picking a typed venue fills Context. Override still allowed. Inline venue create can set type.
- `/settings/sermons/venues` create/edit Type select + C/P/A badge on the list.
- Server save fills context from the venue when the posted context is empty.

## Decided

- **Type lives on the venue as a default**, not instead of `sermons.context_type`. Per-sermon override stays (academic one-off at a church is still possible). Reverses Session 0 “venues have no type” ([090](090-sermons-session-0.md)) now that every live venue is type-homogeneous.
- **Nullable on venues** — untyped locations do not force a context. Draft sermons with no venue are unchanged.
- **No backfill of sermon rows** — every live sermon already had a context; the two no-venue academic drafts stay venue-less.

## Schema changes

- `20260902152000_sermon_venues_context_type.sql` — column + check + majority backfill.

## New components / patterns added

- `src/lib/sermons/venue-context.ts` — `parseContextType` / `contextTypeForVenue` (client-safe). Unit tests `__tests__/venue-context.test.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Every venue already had a single context across all its sermons — no mixed-type locations to resolve.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented — none
- [x] tracker Open Questions updated — n/a (V1/P1 unchanged)
