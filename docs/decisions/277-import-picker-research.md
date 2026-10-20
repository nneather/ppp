# 277 — Import picker research UX and speed

**Date:** 2026-10-19
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Import picker sections (Books of the Bible, Language tools, Custom, Prior papers) start **collapsed**. Bible section display label is **Books of the Bible**; when open, sets split into Old / New Testament.
- Commentary checklist rows lead with series abbreviation (else series name) and volume metadata threaded from `candidatesFromCommentaryHits` / coverage loaders.
- Checklist drill-in is **client state** inside the dialog. `GET /studies/import-checklist.json` loads one set / prior paper / passage list without reloading the study page. Back returns to the picker and keeps checkbox maps.
- Set checklists expose a collapsed **Not included** block (exclude overrides). Select all / Clear ignore those keys; checking one attaches it to the study without flipping the set override.
- Owner **New set** in the dialog (language/custom sections only) and group-header **Save as set** (`saveGroupAsSet`) create a custom set from the paper/sermon without leaving the study. Save as set opens a dialog: editable set name + multi-select of that group’s sources (not a silent one-click, and not tied to “On this passage”).
- Paper/sermon `load` no longer resolves `?import=` checklists; workspace still loads light set summaries + create-section options.

## Decided

- URL no longer owns the checklist — Back was leaving the study via `replaceState` on `?import=`. Dialog-local fetch keeps research on the paper.
- Opt-in not-included rows for this study only; do not mutate set exclude members on import.
- Bible book sections stay locked for New set (same rule as `/studies/sets`).

## Schema changes

- None.

## New components / patterns added

- `src/routes/studies/import-checklist.json/+server.ts` + `src/lib/studies/server/import-checklist.ts`
- `importSelectableKeys` / `importSectionDisplayLabel` / section `kind` + `displayLabel` on `groupImportSetSections`
- `catalogRefsFromGroupSources` + `saveGroupAsSetAction` / `createSet` on paper and sermon detail pages

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- PostgREST nested `books.genre` filters on coverage embeds are unreliable; keep JS `genre === 'Commentary'` after select (same as before).

## Carry-forward updates

- [x] components.mdc
- [x] AGENTS.md studies inventory (import checklist JSON + save-as-set)
- [x] new env vars — none
- [x] PLAN.md
