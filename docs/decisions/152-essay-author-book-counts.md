# 152 — Essay author autocomplete book counts

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc

## Built
- Book detail (`/library/books/[id]`) now loads `loadPersonBookCounts` when the essays section is eligible (`reference_work` / `edited_volume`) and passes `personBookCounts` into `<BookEssaysEditor>` → `<PersonAutocomplete>`.

## Decided
- Load counts only when essays are eligible — monographs never mount the author picker, so skip the `book_authors` paginate round-trip there.
- Reuse existing `loadPersonBookCounts` (same map as book create/edit forms); do not invent a second count path.

## Schema changes
- None

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- `<BookEssaysEditor>` already accepted optional `personBookCounts` (default `{}`), and the autocomplete correctly rendered `N books` — the detail page simply never wired the prop, so every row showed **0 books** (e.g. Schreiner). Book new/edit forms were fine.

## Carry-forward updates
- [x] components.mdc updated — N/A (no new component)
- [x] AGENTS.md inventory updated — N/A
- [x] new env vars documented — N/A
- [x] tracker Open Questions updated — N/A
