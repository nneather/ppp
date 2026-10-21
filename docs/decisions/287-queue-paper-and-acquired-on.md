# 287 — Queue: St. Louis paper done, catalog dates kept

**Date:** 2026-10-21
**Module:** studies | library
**Tracker session:** ad-hoc (PLAN.md › Next up)

## Built

- Nothing coded. Two Do-now lines came off the queue.

## Decided

- The St. Louis publication edit is complete as a queue item. It was never a named paper in the repo. Parker will add papers on `/studies/papers` as he works on them.
- Remaining `acquired_on` values stay the catalog-entry date (`created_at::date`). The 196 Amazon ISBN dates from [283](283-amazon-acquired-on.md) stay. Do not hand-date the other ~1,339 owned books, and do not apply the title-only suggestions.
- A year estimate is worth it only when a Used-in fraction on a book or on `/studies/by-book` looks wrong. Hit rate counts expository, primary-passage sermons and papers dated on or after `acquired_on`. A later catalog date hides earlier sermons from both the uses and the opportunities, so the fraction since the book was entered stays honest. An estimated year that is too early makes missed-use look worse than it was.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- The publication paper that drove [188](188-classwork-research-papers-session-0.md) was never named. The two live papers (Proverbs 31:1–9, submitted; 1 Timothy 2:8–15, researching) are not that item.

## Carry-forward updates

- [x] components.mdc — no component change
- [x] AGENTS.md — no inventory change
- [x] new env vars — none
- [x] Studies tracker B1 closed
