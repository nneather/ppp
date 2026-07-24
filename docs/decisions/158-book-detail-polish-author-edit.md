# 158 — Book detail polish + in-page author edit

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — owner: book detail felt like raw HTML; author tap should fix typos

## Built

- Dropped BookOpen eyebrow icon; genre under authors (not in facts `<dl>`).
- Quieter cite strip + facts labels; series/related links underlined; **On the shelf** merges series siblings + also-by.
- Owner tap on author/editor opens `<PersonEditDialog>` (`?/updatePerson`); **View books** secondary in dialog. Viewers keep list-filter link.
- New [`person-edit-dialog.svelte`](../../src/lib/components/person-edit-dialog.svelte).

## Decided

- **1A** — Edit dialog primary, not navigate-to-filter; full `/library/people/[id]` deferred (C later).
- **2B** — Medium polish this pass; heavier redesign deferred.

## Schema changes

- None.

## New components / patterns added

- `person-edit-dialog.svelte` — edit-only person name dialog + View books link.

## Open questions surfaced

- Optionally refactor book-form-authors to reuse the same dialog (follow-up).

## Surprises (read these before the next session)

- None.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] components.mdc updated
- [ ] AGENTS.md — N/A beyond components inventory
- [ ] new env vars — none
