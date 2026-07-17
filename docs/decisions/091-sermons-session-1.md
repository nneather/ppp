# 091 — Sermons Session 1 (CRUD + seed + library deep-link)

**Date:** 2026-07-17
**Module:** sermons
**Tracker session:** Session 1

## Built

- Schema: `sermon_venues`, `sermons`, `sermon_passages` — migration `20260717190000_ppp_sermons_v1.sql` (RLS owner write + `app_has_module_read('sermons')` SELECT; grants; audit + `updated_at` triggers).
- Seeded 9 venues + 37 sermons (incl. date-only Academic drafts) + structured passages from Parker’s preaching list.
- `/sermons` list with year / context / venue filters; create/edit `<SermonFormSheet>` (notes + passage parse assist + structured rows); soft-delete.
- `/settings/sermons/venues` CRUD; settings hub card; permissions slug `sermons`.
- Nav tab **Sermons**; audit log module filter + soft-delete revert whitelist.
- Library hook: BookOpen → `/library/search-passage?bible_book=&chapter=&verse=` from first structured passage.
- Helpers: `src/lib/sermons/` + `src/lib/types/sermons.ts`; passage-parse unit tests.

## Decided

- Occasion type on sermon only (`church` | `parachurch` | `academic`).
- Passage dual model: `passage_display` + `sermon_passages` child rows; no FK to `scripture_references`.
- Venue soft-delete blocked while live sermons reference (series pattern).
- Viewer write waived; SELECT pre-wired.

## Schema changes

- `20260717190000_ppp_sermons_v1.sql` — tables + seed + RLS/grants/triggers.

## New components / patterns added

- `src/lib/components/sermon-form-sheet.svelte` — create/edit sheet (components.mdc updated).

## Open questions surfaced

- Include `sermon_*` tables in the weekly R2 dump script on next backup touch.

## Surprises (read these before the next session)

- Dry-run then push applied cleanly on hosted prod; types regenerated.
- Mobile tab bar now has seven items — watch crowding on narrow phones.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [x] tracker Session 1 marked done
- [ ] new env vars — none
