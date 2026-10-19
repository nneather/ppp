# 259 — Calvin section-index practice

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (plan: Calvin section-index practice)

## Built

- Section locators (`III.2.12`, range `III.2.12–14`) join `book_outline_sections.locator`. A single section uses the exact outline node when one exists; a range uses the chapter node that covers it. Page indexes still join on the page range.
- Display is the section or the collapsed range plus the outline label (`III.18.1–3 (The Righteousness of Works Improperly Inferred from Rewards)`). The physical volume number is not prefixed.
- Index-mode OCR keeps the printed token. A shortened range is stored as two full locators (`III.2.41` / `III.2.42`). Section tokens are not routed as a page or as set volume III.
- Short outline on Battles volume 2 (`a60309ed-1172-4da0-acdd-daa3c0bee404`): III.2, III.18, IV.1. Seven verified scripture refs (`needs_review` false) for 1 Thessalonians 1:3–4 and 1:5, Romans 5:5 / 8:24 / 10:8, Matthew 8:10 / 25:34.
- Practice gold: `scripts/ocr-index-eval/gold/calvin/` — 7/7 exact on three typeset pages. That run is not the page-index bulk gate.

## Decided

- The pointer stays on `scripture_references.page_start` / `page_end`. No schema change ([252](252-systematics-by-passage-session-0.md)).
- Roman and arabic book numbers match (`III.2` and `3.2`). Turretin locators such as `XV.17` are not section pointers.
- A section token stays on the book being indexed. It does not take the page-routing branch (`III.2.12` is not page 2).
- Practice pages are typeset from the public Institutes scripture-citation index in Battles locator shape. They are not photographs of the Westminster John Knox volume. Shelf photos of the printed index are still the bulk Calvin capture.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/section-pointer.ts` — parse, range expand, display collapse. Byte-identical copy in `supabase/functions/ocr_scripture_refs/section-pointer.ts`.
- `resolveOutlineForPointer` in `outline.ts`.
- `scripts/ocr-index-eval/calvin-ocr.ts` — re-run the practice OCR (`ANTHROPIC_API_KEY`).

## Open questions surfaced

- III.2’s opening page (543) and the definition at III.2.7 (p. 551) are from Battles quotations. III.18 `825–860` and IV.1 `1012–1048` are order placeholders so the outline rows have page columns. The locator join does not read them. Replace them from the shelf TOC when the full outline is pasted.
- Bulk Turretin / van Mastricht / Bavinck still wait on the ≥99.5% page-index gate.

## Surprises (read these before the next session)

- Decision 258 was taken by study-attachments while this session was open. This file is **259**.
- The public citation index lists sections one at a time. The printed Battles index compresses consecutive sections (`III.18.1–3` for Matthew 25:34; `III.2.41–42` for Romans 8:24). 1 Thessalonians 1:5 is IV.1.6, not a III.2 range.
- `compute_verse_abs` ignores `verse_end` unless `chapter_end` is set. The 1 Thessalonians 1:3–4 row stores `chapter_end = 1`.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] new env vars — none
- [x] Edge `ocr_scripture_refs` deployed (section normalizer + index-mode prompt)
