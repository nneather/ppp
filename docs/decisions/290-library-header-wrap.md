# 290 — Library header stops collapsing

**Date:** 2026-10-21
**Module:** library
**Tracker session:** ad-hoc

## Built

- `/library` title and the “Showing 50 of …” line stay readable when the sidebar and Now rail leave a narrow content column.
- Page-header actions can wrap. The title block keeps a 12rem minimum. The count (and other `meta`) sits under the whole header, not inside the squeezed title column.
- Library list and book-detail action rows use `w-max max-w-full` so the nowrap buttons wrap inside that column instead of forcing the title to a few pixels.

## Decided

- Fix this in `PageHeader`, which every module uses. The crush came from `shrink-0` actions plus `min-w-0` and `hyphens-auto` on the title: leftover width hyphenated “Library” one letter per line.
- Drop `hyphens-auto` on the heading. `break-words` still wraps a long title.

## Schema changes

- None.

## New components / patterns added

- None. `page-header.svelte` layout only.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `md:` is the viewport, not the content column. At a laptop width the viewport is already `md`, but the column is viewport minus `w-56` nav and `w-96` Now rail. A row of four nowrap buttons then consumes the column.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated — no new helper
- [x] new env vars documented — none
- [x] tracker Open Questions updated — none
