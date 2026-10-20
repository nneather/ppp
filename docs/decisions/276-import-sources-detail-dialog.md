# 276 — Import sources detail dialog

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Replaced the paper/sermon import side sheet with a large centered dialog (`paper-import-dialog.svelte`): desktop `max-w-3xl` / ~85dvh, mobile ~92dvh.
- Checklist rows show series abbreviation (when present), full title, author line, optional “N vols.”, section hint, and prior-paper notes. Authors wrap; they are plain text so the dialog stays put.
- Rows start unchecked. Filter matches title / abbreviation / author. Title keeps loader order; Author sorts with blank authors last. **Select all** and **Clear** apply to the visible, unattached rows.
- Loaders pass `authors`, `seriesAbbreviation`, and `volumeCount` for set members, prior-paper sources, and “On this passage” books (authors via `authorLabelsForRefs`; section books embed series + `total_volumes`).

## Decided

- Dialog over Sheet: this is a deliberate attach pass for commentary-sized lists, not a quick side action. Catalog search on the page stays the one-off add path.
- Default unchecked + Select all: importing a whole commentary set is one click without dumping every row by surprise.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/paper-import-dialog.svelte` (replaces `paper-import-sheet.svelte`)
- `visibleImportChecklistRows` / `importChecklistLead` in `src/lib/studies/import-suggest.ts`

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- None.

## Carry-forward updates

- [x] components.mdc
- [x] AGENTS.md — no new server helper barrel entry needed beyond existing studies inventory
- [x] new env vars — none
- [x] PLAN.md
