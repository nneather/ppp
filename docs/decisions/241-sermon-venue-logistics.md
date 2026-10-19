# 241 — Sermon venue logistics

**Date:** 2026-10-19
**Module:** sermons
**Tracker session:** Ad-hoc (venue service time, drive, hymnal, notes)

## Built

- `sermon_venues` logistics: `service_start` (time), `drive_minutes` (1–600), `depart_by` (time, labeled Leave by), `hymnal` (closed preset), plus the existing `notes` column now edited as a textarea.
- Hymnal presets: Trinity Hymnal, The Celebration Hymnal, The Hymnal for Worship and Celebration. The third is on the list and unused.
- `/settings/sermons/venues` create/edit and a logistics line on each row.
- Sermon Sheet shows the selected venue’s logistics and notes. Dashboard upcoming sermons show the logistics line. `list_upcoming_sermons` picks it up because it returns the dashboard row.
- Initial fill (notes were empty):
  - Mt. Zion Presbyterian — 9:30 AM, 55 min, leave by 8:15 AM, Trinity Hymnal. Larry sends the bulletin Saturday (often evening).
  - Grandcoate Presbyterian — 11 AM, 75 min, leave by 9:20 AM, Trinity Hymnal. Donna wants to hear by Thursday; she needs it by EOD Thursday.
  - Marissa Presbyterian — 10:30 AM, 60 min, leave by 9:10 AM, The Celebration Hymnal. Larry checks Wednesday; he needs it by Thursday night.
  - Res Pres Madison — 10:30 AM only.

## Decided

- **Leave-by is its own column**, not notes and not `service_start − drive_minutes`. The cushion past the drive is 20, 25, and 20 minutes for the three churches that have one.
- **Hymnal is a slug** (`trinity` | `celebration` | `worship_and_celebration`), not free text. Marissa’s “The Celebration Hymnal: Songs and Hymns for Worship” is the full title of The Celebration Hymnal, so it uses `celebration`.
- **“Res Pres” is Res Pres Madison**, the existing venue. No new row.
- Inline “add venue” on the sermon Sheet still takes name + type only. Logistics are filled on the venues settings page.

## Schema changes

- `20261019152923_sermon_venue_logistics.sql` — four columns, checks, backfill. Applied to prod. Audit trigger wrote the four UPDATEs.

## New components / patterns added

- `src/lib/components/venue-form-fields.svelte` — shared create/edit fields.
- `src/lib/sermons/venue-logistics.ts` — parse + display. Unit tests `__tests__/venue-logistics.test.ts`.

## Open questions surfaced

- None. The Hymnal for Worship and Celebration is available and not assigned.

## Surprises (read these before the next session)

- Leave-by does not fall out of start time and drive length. Don’t compute it.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented — none
- [x] tracker Open Questions updated — n/a
