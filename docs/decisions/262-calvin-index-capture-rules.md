# 262 — Calvin index capture rules

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (Calvin section-index practice)

## Built

- Index-mode OCR treats a printed Arabic locator (`1.13.7`) as Book 1, chapter 13, section 7. The leading number is not a set volume. A repeated identical line stays two rows. A chapter list (`chs. 1; 2`) is one citation.
- On save, a section locator is stored on the volume whose outline contains that chapter. `1.13.7` lands on volume 1; `3.20.4` lands on volume 2. With no matching chapter, the row stays on the book being indexed.
- Version tags (`cf Vg`, `LXX`, `EV`, `Gr.`, `Comm.`, `p.`) are removed from the locator and kept on `review_note`. They do not force review. `PA`, `VG`, and `VL` stay on the book being indexed and are flagged; they are not joined to the Battles outline.

## Decided

- No new column. The English verse stays in the chapter/verse fields. The tag sits on `review_note`.
- Edition markers are not Battles sections. The Prefatory Address and the 1560/1559 editions are reviewed by hand.
- Page-index routing (`2:620`) is unchanged.

## Schema changes

- None. `ocr_scripture_refs` prompt and `review_note` passthrough only.

## New components / patterns added

- `src/lib/library/scripture-index-qualifiers.ts` — peel version tags; detect `PA` / `VG` / `VL`.
- `loadSetVolumeBooks` — chapter locators and page bounds for every volume in a set.

## Open questions surfaced

- Shelf photos of the Battles index are still the capture. This does not clear the page-index gold gate for Turretin, van Mastricht, or Bavinck.

## Surprises (read these before the next session)

- The index prompt already had Turretin volume:page rules (three columns, `6:4—2:365`). The Arabic locator rules were added beside those, not in place of them.

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [x] PLAN.md recent decisions
- [x] Edge function deployed with the prompt
