# 273 — Outline topic dropdowns

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc

## Built

- On `/library/books/[id]`, outline rows that have children are collapsed dropdowns. Opening a topic shows its questions and its headings. Headings that have questions are dropdowns too, also closed at first.
- Calvin’s book headings nest the same way. `I.1` has no `parent_id`, so the list attaches it to the `I` row on that volume. Volume 1 opens to the prefaces plus Books I–III. Book III on volume 2 holds chapters 20–25.

## Decided

- A chapter locator (`I.1`) with no parent nests under the book heading (`I`) on the same volume. An explicit `parent_id` still wins, so Turretin questions stay under their headings.
- Editing a row opens its ancestors so the form is on screen.

## Schema changes

- None.

## New components / patterns added

- `buildOutlineTree` in `src/lib/library/outline.ts`.
- `src/lib/components/outline-section-list.svelte` and `outline-section-branch.svelte`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- A one-way `open={isOpen}` on `<details>` swallowed the click. `bind:open` on each section is what toggles.

## Carry-forward updates

- [x] components.mdc
- [x] AGENTS.md
- [x] new env vars — none
- [x] PLAN.md
