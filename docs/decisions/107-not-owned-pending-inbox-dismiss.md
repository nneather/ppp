# 107 — Not-owned settings pending inbox + dismiss

**Date:** 2026-07-21
**Module:** library
**Tracker session:** not-owned UX polish (after [103](103-library-not-owned-session-1.md))

## Built

- `/settings/library/not-owned` is a **pending inbox**: only uncreated, non-dismissed rows show by default.
- **Don’t create** dismisses via `localStorage` (`ppp.library.notOwnedDismissed`).
- Collapsed **Created** / **Dismissed** archives (Open stub / Restore).
- Helper: `src/lib/library/not-owned-dismiss.ts` + unit tests.

## Decided

- List model: pending-only main list (created leave inbox; still findable via Include unowned / detail).
- Dismiss store: localStorage (solo/PWA; same pattern as people-merge dismiss). Rejected: DB table for this polish; editing the queue file for dismiss.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/not-owned-dismiss.ts` — parse/serialize + load/save/dismiss/restore.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- None.

## Carry-forward updates

- [x] AGENTS.md inventory + PLAN.md
- [ ] new env vars — none
