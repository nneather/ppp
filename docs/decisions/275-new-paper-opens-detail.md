# 275 — New paper opens its screen

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Saving **New paper** on `/studies/papers` goes straight to `/studies/papers/[id]`. A failed save stays on the sheet with the error.

## Decided

- Same landing as **Open research paper** from an assignment: a `303` from the `createPaper` action. The sheet’s `use:enhance` callback already calls `update()`, which follows that redirect.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- None.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] PLAN.md
