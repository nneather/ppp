# 301 — Systematics verse reading order

**Date:** 2026-10-23
**Module:** studies
**Tracker session:** ad-hoc

## Built

- By verse lists the sets that actually hit that verse in reading order: Calvin, Bavinck, van Mastricht, Turretin, Leiden. A set with no hit on the verse is left out.
- Inside one set, rows run by volume, then page (`I:233` before `II:134`; `II:50` before `II:134`). Calvin section locators use the same volume-then-locator order.
- Any other systematic theology sorts after those five, alphabetically by series, then volume and page.

## Decided

- Match the five sets on series name or author (`calvin`, `bavinck`, `mastricht`, `turretin`, `synopsis` / `leiden` / `purer theology`), so the catalog titles do not have to be the short names.
- By systematic stays alphabetical by series name. This change is only the rows under a verse.

## Schema changes

- None.

## New components / patterns added

- `systematicReadingRank` in [`src/lib/library/outline.ts`](../../src/lib/library/outline.ts), used by `groupSystematicPointersByVerse`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Romans 1:16 on `/library/search-passage` currently has only Calvin and Turretin. Bavinck, van Mastricht, and Leiden stay out until those indexes exist. Under `1:16–17`, Calvin’s `3.2.29` precedes Turretin `I:52`, then `II:172`, `II:176`, `II:186`, `II:637`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (none)
