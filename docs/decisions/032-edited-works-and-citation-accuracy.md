# 032 — Edited works marker + Turabian accuracy pass

**Date:** 2026-05-19
**Module:** library
**Tracker session:** citation / mobile polish

## Built

- **Mobile library actions:** Replaced the `⋯ More` bottom sheet on `/library` with a 4-column icon+label row (New book, Add by ISBN, Search passage, Review queue) matching the bottom tab bar pattern. Review-queue count shows as a badge when the needs-review filter is active.
- **Turabian refactor:** `joinNoteSegments` / `joinBibSegments` in `format.ts` — canonical §17.1 piece-by-piece joining (comma before title/credits/edition; space before `(Place: Pub, year)`; comma before page). Fixed comma-before-paren, bare page numbers (no auto `p.`), bibliography `and` before last author/editor, author+editor credits (`ed.` / `Edited by`), bibliography edition capitalization, commentary-in-series bib including edition + vol count + editor/translator.
- **`books.work_type`:** Migration `20260519120000_books_work_type.sql` — `monograph` | `edited_volume` | `reference_work` (default `monograph`). Book form Work type select; OL prefill suggests `reference_work` for dictionary/encyclopedia/lexicon subjects. `resolveCitationSourceType` honors `work_type` before genre inference. `computeMissingImportant` requires editors (not authors) when `work_type !== 'monograph'`. List/review cards fall back to editor labels with `, ed.` / `, eds.`.
- **Tests:** 24 vitest cases with exact-string assertions against [Covenant Seminary Turabian guide](https://covenantseminary.libguides.com/turabian/books).

## Decided

- **Notes use series abbreviation when present** (e.g. `WBC` not full series name in footnotes) — existing behavior kept; Covenant example uses full name but abbreviations are standard for dense notes.
- **Author + editor + translator** on one book → `single-author-book` path with all three credit segments (editor before translator by default; title-page order override deferred).
- **Essays UI not enabled** — `work_type` + existing `essays` schema are the wedge for future `chapter-in-edited-volume` and `article-in-reference-work` (`s.v.`) formatters.

## Schema changes

- `supabase/migrations/20260519120000_books_work_type.sql` — `books.work_type` TEXT NOT NULL DEFAULT `monograph` with CHECK.

## New components / patterns added

- `WORK_TYPES` / `WORK_TYPE_LABELS` in `src/lib/types/library.ts`
- `formatEditorsCreditNote` / `formatEditorsCreditBibliography` in `names.ts`
- `authorsLabelForBook()` in `loaders.ts` for editor-only display on list/review cards

## Sample citations (verified in tests)

| Case | Footnote |
|------|----------|
| Single author | `V. Philips Long, The Art of Biblical History (Grand Rapids, MI: Zondervan, 1994), 123.` |
| Author + editor | `C. S. Lewis, Christian Reflections, ed. Walter Hooper (Grand Rapids, MI: William B. Eerdmans, 1967), 83.` |
| Edited volume | `William S. Barker and Samuel T. Long, eds., Sermons that Shaped America (Phillipsburg, NJ: P&R Publishing, 2004), 79.` |
| Series (note uses abbr) | `Stephen S. Smalley, 1, 2, 3 John, WBC (Waco, TX: Word Books, 1984), 82.` |

## Open questions surfaced

- **Subsequent (short) footnotes** (§16.4.1) — not implemented; track for a future session.
- **Sr./Jr./III** name suffix parsing — `parsePersonLabel` does not split suffixes yet.
- **Title-page credit order** for author+editor+translator — default editor-then-translator; may need per-book ordering later.

## Surprises (read these before the next session)

- PostgREST selects on `work_type` fail until migration is applied to the hosted project (`npm run supabase:db:push:dry` then `push`).
- `database.ts` was updated manually for `work_type`; re-run `npm run supabase:gen-types` after push to reconcile.

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [ ] components.mdc — no new shared components
- [x] `work_type` documented in library-module.mdc
