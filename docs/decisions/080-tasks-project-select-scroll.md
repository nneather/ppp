# 080 — Tasks project select scroll

**Date:** 2026-07-10
**Module:** projects
**Tracker session:** ad-hoc (MYN polish)

## Built
- Cap long project `<Select.Content>` lists at `max-h-72` so the dropdown scrolls instead of clipping at the viewport bottom on mobile.
- Task sheet Notes field grows to fill remaining sheet height (`flex-1`, `min-h-48`, `resize-none`); sheet height bumped to `92dvh` / `720px` to match other content-heavy sheets.

## Decided
- Reuse the existing app pattern (`max-h-72` on `Select.Content`, same as time-entry / book-form / invoice sheets) rather than changing the shared `ui/select` primitive or switching to a native picker / searchable sheet.
- Notes expand into leftover sheet space (email bodies are the common case) rather than a fixed `rows={4}` box with empty whitespace below.

## Schema changes
- None

## New components / patterns added
- None — applied existing `max-h-72` to:
  - `project-task-sheet.svelte` (New/Edit task → Project)
  - `tasks/+page.svelte` (Project filter)
  - `project-form-sheet.svelte` (Parent picker)

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Base `Select.Content` has `overflow-y-auto` but no max-height, so long lists grow unboundedly; callers must pass `max-h-*` (or the list clips under the sheet / screen edge).

## Carry-forward updates
- [x] components.mdc updated (N/A — no new component)
- [x] AGENTS.md inventory updated (N/A)
- [x] new env vars documented (N/A)
- [x] tracker Open Questions updated (N/A)
