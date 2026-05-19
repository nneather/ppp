# 033 — Library PM review (mobile + citations + process)

**Date:** 2026-05-19
**Module:** library
**Tracker:** PM review (pre-trip)

## Built

- Mobile: sticky scripture save bar; list header restored to New book + ⋯ sheet (023 pattern); `hotkey="b"` on mobile New book; `pb-tabbar` on review; larger touch targets on list filters/checkboxes and scripture checkboxes; `<PageHeader>` on add, search-passage, bibliography, new, edit, review.
- Integrity: `ship-library` / `ship-library:apply` npm scripts; `updateReadingStatus` + `loadPersonBookCounts` soft-delete fixes; review burndown without inline `style=`; OCR Edge library module + book access checks, 50/day usage cap table, tightened CORS.
- Citations: structured Turabian names (`suffix`, `last_name` on assignments); `shortForm` footnotes (`ibid` / `short`); `formatEssayFootnote` (`s.v.` wedge); expanded vitest coverage (31 tests).
- Extract: `<ScriptureBiblePickerSheet>` from scripture form.
- Process: trimmed `PLAN.md`; Wave 2 section on tracker; stale rule patches; three `.claude/skills/` workflows; large-svelte growth hook; commit-message convention in `AGENTS.md`.

## Decided

- List mobile chrome: restore overflow sheet over 032’s four-column grid (matches book detail).
- OCR rate limit: `library_ocr_usage` table + service-role upsert (soft cap, not hard billing).
- CORS: reflect `SITE_URL` / `CORS_ALLOWED_ORIGINS` / `*.vercel.app` instead of `*`.

## Schema changes

- `20260519130000_library_ocr_daily_usage.sql` — per-user daily OCR counts (RLS on, no client policies).

## New components / patterns added

- `src/lib/components/scripture-bible-picker-sheet.svelte` — mobile Bible book picker sheet.
- `src/lib/library/turabian/article.ts` — dictionary / essay `s.v.` footnotes.
- `npm run ship-library` / `ship-library:apply` — migration + gen-types + test + deploy-functions gate.

## Open questions surfaced

- Full megacomponent split (`scripture-reference-form`, `book-form`) — owner — August Wave 2.
- `library_ocr_usage` + `work_type` migrations must ship via `npm run ship-library:apply` before prod OCR/list rely on them.

## Surprises (read these before the next session)

- Svelte 5: `bind:open` on lowercase custom elements fails — use PascalCase component tags for `$bindable` props.
- Reprint bibliography still uses first-edition pub block only; reprint parenthetical is footnote-only today.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (`SITE_URL`, `CORS_ALLOWED_ORIGINS` for OCR Edge)
- [x] Hosted ship verified 2026-05-19 (`db push`, `gen-types`, `deploy-functions`; `check` + 38 tests pass)
- [ ] tracker Open Questions updated
