# 266 — Book detail outline and passage sections start collapsed

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc

## Built

- On `/library/books/[id]`, Outline and Passage sections use the same disclosure as Scripture references. Both start closed. The header keeps the count. Expanding shows the list and the add / paste controls.
- A `#section-<uuid>` link still opens Passage sections and scrolls to that row.
- Starting add, paste, or edit opens the panel so the form is on screen. Switching books closes both panels again.

## Decided

- Empty panels stay closed too. The header is enough to find them. Scripture references still open when a book has no refs.

## Schema changes

- None

## New components / patterns added

- None. Markup lives on the book detail page.

## Open questions surfaced

- None

## Surprises (read these before the next session)

- None

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] tracker — ad-hoc; no session to tick
