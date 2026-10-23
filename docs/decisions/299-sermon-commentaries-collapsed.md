# 299 — Sermon commentaries collapsed

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Each Bible book on a sermon is a closed card: name, commentary count, chevron. Open it for the By book rows and Attach.
- A book added from the topical picker starts open. Passage shelves stay closed.

## Decided

- Same card as the systematic theologies on that page (`<details>`, closed until the user opens it), one card per Bible book.
- The Commentaries heading stays visible so the shelf is findable without opening it.

## Schema changes

- None.

## New components / patterns added

- None. `src/lib/components/sermon-commentaries.svelte` grew the disclosure.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `npm run check` in this tree reports errors in in-progress sports files (`espn.test.ts`, `/sports` page server). This change does not touch them. Repo gate left at the last green stamp.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker note updated
