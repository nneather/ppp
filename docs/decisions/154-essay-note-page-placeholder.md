# 154 — Essay/chapter footnote defaults to `[page]`

**Date:** 2026-07-24
**Module:** library
**Tracker session:** Wave 2 August shelf QA Track B (row 19)

## Built

- `formatEssayFootnote` / short form: empty page override → **`[page]`**, never stored `page_start`–`page_end`.
- `formatEssayBibliography` unchanged — still emits the essay’s page span for chapters.
- Split helpers in [`article.ts`](../../src/lib/library/turabian/article.ts): `notePageSegment` vs `bibPageSegment`.
- Essays editor hint updated; unit test for chapter with range.

## Decided

- Overturn [094](094-library-writing-session-gaps.md) for **notes only**: writing-session copy should paste a locus placeholder (same as book Footnote), not the full article range. Range belongs in the bibliography entry.
- Typed page override still wins for Footnote / Short form when the owner fills the page input.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Track B row 19 (*Women in the Church* / chapter-in-edited-volume shape) was the trigger; ABD/TDNT notes with an empty page input now also show `[page]` until a locus is typed (intentional consistency).

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] AGENTS.md turabian inventory one-liner
- [ ] components.mdc — N/A
- [ ] new env vars — none
