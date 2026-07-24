# 155 — Batch essay entry + remove top preview

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc

## Built
- **Batch create** on `<BookEssaysEditor>`: N draft rows (Add / Duplicate / Remove) → one `?/createEssaysBatch` save (`rows_json` + `parent_book_id`). Edit stays single-row (`?/updateEssay`).
- Server: `parseEssayRowFields`, `parseEssaysBatchForm`, `createEssaysBatchAction` in `essay-actions.ts` (skip blank titles; fail closed before insert; sequential essay inserts then batched `essay_authors`).
- Removed the near-title essays preview card on `/library/books/[id]` (first-3 + “View all” from [086](086-essay-visibility-and-search-lanes.md)). Eyebrow article count + bottom section / `#essay-…` deep links kept.

## Decided
- Mirror topics/scripture batch shape rather than inventing a sheet or CSV path — TOC entry for edited volumes is the pain point (*Women in the Church*).
- Sequential essay inserts (not one multi-row insert) so author pairing stays reliable at TOC-scale batch sizes.
- Leave `?/createEssay` wired for reuse/tests; UI create path always uses the batch action (even for one row).

## Schema changes
- None

## New components / patterns added
- None (extended `<BookEssaysEditor>` + essay-actions)

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Decision numbers 153–154 were taken by concurrent sessions (classwork Session 1; essay note placeholder) — this file is **155**.

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented — N/A
- [x] tracker Open Questions updated — N/A
