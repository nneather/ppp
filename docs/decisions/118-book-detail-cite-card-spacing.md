# 118 — Book detail cite card + denser facts

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc follow-up to [114](114-book-detail-ui-cleanup.md) — owner: spacing still floaty; wanted cite box back

## Built

- [`/library/books/[id]`](../../src/routes/library/books/[id]/+page.svelte):
  - Restored compact muted bordered **Cite** card (desktop + mobile `<details>`).
  - Tighter fact rows (`gap-y-1.5`, `leading-snug`); main grid `1fr + 17.5rem` so status sits in a fixed sidebar instead of facts stretching across empty 2/3 width; section gap `mt-4` / `gap-4`.

## Decided

- Quiet card beats border-only toolbar for the Turabian strip (owner preference after 114).
- Fixed-width status column reads denser than `md:grid-cols-3` + `col-span-2`.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- None.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — 2026-07-22
