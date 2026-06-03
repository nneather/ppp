# 031 — Library Session 8 — Turabian module + Turabian-first review queue

**Date:** 2026-05-18  
**Module:** library  
**Tracker session:** Session 8

## Built

- **`src/lib/library/turabian/`** — pure-function Turabian 9th-ed. formatters (`formatFootnote`, `formatBibliography`, `formatCompiledBibliography`, `resolveCitationSourceType`). No DB calls inside formatters. Input = `BookCitationInput` / `bookDetailToCitationInput` / `reviewCardToCitationInput`.
- **Clipboard (Q4)** — `copyCitationToClipboard` writes `text/html` + `text/plain` via `ClipboardItem`; `writeText` fallback.
- **Book detail** — Copy Footnote + Copy Bibliography alongside Session 6 raw-field copy buttons.
- **`/library/bibliography`** — `?ids=` CSV; sorted bibliography + one Copy button. Entry from `/library` bulk selection bar.
- **Turabian-first `/library/review`** — card renders footnote + bibliography (`<TurabianCitationBlock>`); Citation Critical / Backlog slice pills + `?slice=`; Sept 1 default via `defaultReviewSlice()`; localStorage burndown (`library.review.today`, `lifetime_critical`, `lifetime_backlog`); sticky mobile thumb bar (Confirm / Field wrong / Skip); scripture/topic counts on card.
- **`loadReviewQueue` expansion** — citation-critical columns + full `authors[]` + `topics_count` / `scripture_refs_count`.
- **Dashboard library tile** — second line citation-verified / backlog cleared via `<DashboardLibraryTileFooter>` + deep link `?slice=critical|backlog`.
- **Unit tests** — `src/lib/library/turabian/__tests__/format.test.ts` (9 cases); `npm run test`.

## Decided

- **One `turabian/` module** powers book detail, bibliography builder, and review cards — no duplicate formatters.
- **HTML + plain-text clipboard only** for citations (Q4); no file export.
- **localStorage-only burndown** — no server stats schema; denominators 265 / 1,020 from tracker estimates (`SLICE_DENOMINATORS`).
- **Citation Critical genres** (post-022): Commentary, Bibles, Biblical Reference, + five Language Tools genres — enumerated in `CITATION_CRITICAL_GENRES`.
- **Swipe / haptic** deferred to Session 8.5 per tracker.

## Schema changes

- None.

## New components / patterns added

- `src/lib/components/turabian-citation-block.svelte` — monospace citation preview + Copy.
- `src/lib/components/dashboard-library-tile-footer.svelte` — burndown second line on dashboard.
- `src/lib/library/turabian/review-progress.ts` — localStorage keys + Sept 1 slice default.
- `src/lib/library/review.ts` — `applyReviewSliceGenreFilter`, `parseReviewFilters` `slice` param.
- `npm run test` — vitest for turabian unit QA.

## Open questions surfaced

- **Full ~265 scholarly-core spot-check** — deferred to August (shelf home); unit tests + manual 20-row pass when convenient.
- **PostgREST `.or()` backlog filter** — `genre.is.null,genre.not.in.(…)`; monitor if exotic genre strings need escaping.

## Surprises

- Library list already had bulk `selectedIds` — bibliography builder reuses that bar (no new selection UX).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md Recent decisions + last-updated
- [ ] Tracker Session 8 rows — Turabian 20-row shelf QA deferred August; trip phone signoff via [043](043-library-trip-qa-signoff-projects-handoff.md)
- [x] Session 8.5 swipe/haptic shipped [036](036-session-8-5-review-queue-polish.md); owner smoke [043](043-library-trip-qa-signoff-projects-handoff.md)
