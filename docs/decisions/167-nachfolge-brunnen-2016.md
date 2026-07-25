# 167 — Nachfolge remint to Brunnen 2016

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (shelf edition remint)

## Built
- Migration `20260724240100_library_nachfolge_brunnen_2016.sql` (applied hosted): UPDATE Bonhoeffer *Nachfolge* (`f06ea498-…`) from incorrect Kaiser / 1928 / english metadata to Brunnen 2016 hardcover

## Decided
- ISBN **9783765509483** (2016 hardcover w/ Peter Zimmerling intro) — not the 2026 paperback 9783765521973
- Free-text publisher **Brunnen Verlag** + location **Gießen** (no `publisher_id`; sibling Markus commentary still free-text `Brunnen`)
- `year=2016`, `original_year=1937`, `language=german`, `page_count=320`

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Migration timestamp had to land after `20260724240000_library_loeb_classical_library.sql` (Loeb already on remote) — renamed from `…235755` → `…240100`
- Prior row had year 1928 and language english (Kaiser ISBN) — citation was wrong before remint

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A (DML only)
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
