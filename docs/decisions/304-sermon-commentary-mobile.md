# 304 — Sermon commentary rows on a phone

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- On a phone, a commentary row leads with the series abbreviation (the title, when there is no series) and the author. Stars, Attach, and Dismiss sit on the next line, with the two actions the same width.
- Wider than the mobile tab bar, the row stays title, author, series, hit rate, stars, and stacked actions.
- By book uses the same row, so its phone shelf gets the same lead line. Dismiss by default stays one line beside the stars.

## Decided

- The phone lead is the series abbreviation. The title and author are the second line. A one-character wrap of the title beside the abbreviation was what the old single row produced once the stars and two buttons took the width.
- Desktop is unchanged. The breakpoint is `md`, the same width where the tab bar goes away.

## Schema changes

- None.

## New components / patterns added

- None. `commentary-shelf-hit.svelte` and the sermon list dividers.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `flex-1` and `md:flex-none` on the same button collapsed the Dismiss control. The action pair is a grid of equal columns instead.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated — no new helper
- [x] new env vars — none
- [x] tracker note updated
