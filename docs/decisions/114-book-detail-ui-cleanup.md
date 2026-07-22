# 114 — Book detail UI cleanup

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — owner: book detail felt messy; glance-first + quieter cite strip

## Built

- [`/library/books/[id]`](../../src/routes/library/books/[id]/+page.svelte) polish:
  - **Cite strip** near top: Page + Footnote / Short form / Bibliography only; dropped Authors / Title / Publisher + year / All fields; quieter `border-b` toolbar (mobile still collapsible `<details>`).
  - **Bibliographic `<dl>`:** fixed label column (`6.5rem` / `7.5rem`) with tight `gap-x-3` so values sit next to labels.
  - **Mobile order:** facts first, then personal status (single render path — aside under facts on small screens, right column on `md+`).
  - **Status card:** lighter border/padding; spacing instead of repeated `border-t` mini-sections.

## Decided

- Primary job for now: glance bibliographic facts + personal status; citation stays convenient but not a hero box.
- Raw-field copy buttons removed from the detail surface (`book-copy-text.ts` helpers retained for potential reuse).

## Schema changes

- None.

## New components / patterns added

- None (in-page snippets only).

## Open questions surfaced

- Owner phone smoke of cite strip + facts scan at mobile width.

## Surprises

- Border-only cite strip felt floaty — restored card + denser facts in [118](118-book-detail-cite-card-spacing.md).

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — 2026-07-22
