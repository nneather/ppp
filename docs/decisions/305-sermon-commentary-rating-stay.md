# 305 — Sermon commentary rating stays put

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Clicking a star on a sermon commentary saves `books.rating` and leaves the page where it is. The row keeps its place. The shelf sorts by the new rating the next time it loads.
- By book still reloads after a rating, so that catalog re-sorts immediately.

## Decided

- The sermon working list should not jump while several commentaries are being ranked. The sort is a load-time order, not a live one.
- The star control already shows the chosen rating before the save returns. A failed save puts the previous stars back.

## Schema changes

- None.

## New components / patterns added

- None. `commentary-shelf-hit.svelte` skips `invalidateAll` when the row belongs to a sermon.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `invalidateAll` on this action replaced the streamed commentary promise, so the open shelf collapsed and came back in the new order. That was the refresh.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated — no new helper
- [x] new env vars — none
- [x] tracker note updated
