# 285 — Systematics dismiss

**Date:** 2026-10-20
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Each systematic hit has Attach and Dismiss in a fixed column on the right. The citation wraps beside them instead of leaving Attach on its own line.
- Dismiss hides that index hit on this sermon or paper. A **Show dismissed (N)** control brings them back; each hidden row then has Restore.
- The set is stored in localStorage (`ppp.studies.systematicsDismissed.<parentId>`). It is not a library delete. Passage search, which has no study id, keeps the set for the page session only.

## Decided

- Dismiss is per study, keyed by scripture-reference id, so hiding Turretin on Ecclesiastes 7 does not hide the same row on another sermon.
- Already-attached volumes still show Attached in that same column, with Dismiss under it.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/studies/systematics-dismiss.ts`](../../src/lib/studies/systematics-dismiss.ts) — parse / load / save / visible-row filter.
- [`src/lib/studies/systematics-cards.ts`](../../src/lib/studies/systematics-cards.ts) — set cards and verse cards after the dismiss filter.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- None.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (none)
