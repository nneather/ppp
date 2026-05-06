# 016 — Library misc UX, sorting, bulk update, OL refresh, language audit

**Date:** 2026-05-06
**Module:** library
**Tracker session:** (misc improvements batch)

## Built

- Desktop shell bottom padding (`md:pb-8`); `/library` facet column tightened (`13.5rem`), scrollable sticky panel, smaller chips/sections.
- Shared `titleSortKey` + German articles when `language === 'german'`; `BookListRow.language`; import scripts use `stripArticlesForImporterMatchKey`.
- `BookOlRefreshDialog` + edit flow: refresh metadata from ISBN (camera + manual), field checkboxes, merge into `BookForm`; detail page link `?ol=1`; `bind:olRefreshOpen` on edit page.
- `/library` multi-select + `bulkUpdateBooks` action (language / reading status / genre), chunked SQL updates.
- `scripts/library-language-audit/` — Open Library + heuristics TSV + optional `--apply` with `LIBRARY_LANGUAGE_AUDIT_CONFIRM=yes`; npm script `library:language-audit`.
- PLAN “Design backlog” bullets; AGENTS script line; `components.mdc` + `library-module.mdc` pointers.

## Decided

- Language audit uses the same **migrate** env vars by default: **`LIBRARY_AUDIT_DATABASE_URL`** (optional override) → **`LIBRARY_DST_DATABASE_URL`** → **`LIBRARY_SRC_DATABASE_URL`**.
- Bulk updates limited to safe scalar fields (no junctions); max 150 ids per request; apply gate uses OL German / genre+text / `--aggressive` for umlaut-only.
- Language audit defaults conservative: `--apply` without `--aggressive` skips umlaut-only rows unless OL lists German.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/book-ol-refresh-dialog.svelte` — OL ISBN refresh with scan + merge pickers.
- `src/lib/library/title-sort.ts` — sort + importer article stripping.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Edit-page `?ol=1` strip uses client `$effect` + `goto(replaceState)` so the query param does not linger.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (README + AGENTS)
- [ ] tracker Open Questions updated (n/a)
