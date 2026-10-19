# 263 — Systematics page-index gold gate

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (plan: systematics page-index gold gate)

## Built

- Hand transcription of three dense Turretin scripture-index leaves (P&R vol. 3): printed pp. 764 (Acts 14–Romans 1), 766 (Romans 6–9), and 760 (John 3–8). Rasters stay in `scripts/ocr-index-eval/images/` and are gitignored.
- Gold rows: `gold/page-0N.lines.txt` → `build-gold.ts` → `page-0N.json`. **1,025** page-pointer rows (313 + 392 + 320). A dense leaf is about 300–400 rows; the planning guess of 200–300 was low.
- Index-mode OCR (`page-ocr.ts`: ink-histogram column split, two passes, consensus) → `page-0N.ocr.json`. Deployed `ocr_scripture_refs` so the live index-mode prompt matches the repo (Turretin `vol:page` rules plus the Calvin locator rules from [262](262-calvin-index-capture-rules.md)).
- **1,021/1,025 exact (99.610%). Gate pass.** `compare.ts` on `gold/` does not read `gold/calvin/`.
- OCR time: printed p. 764 **3.2 min**, p. 766 **3.7 min**, p. 760 **2.8 min**.

## Decided

- The scripture index is in **vol. 3 only**. Three columns. Arabic `vol:page` (volume 2 page 620 is `volume: "2"`, `page_start: "620"`). Pagination is per volume, not continuous. The book name is printed only when the book changes; a continuation leaf is filled from `running_book` before compare, the same carry the batch merge uses.
- The index opens at Genesis on the leaf before printed p. 740 and runs through printed p. 780. Hebrew and Greek word indexes follow, then works cited.
- Column split detects two or three text columns. A hard midpoint cut was slicing the middle column of this index.
- A comma verse pair (`6:3, 4`) is one range (`chapter_end` set). A semicolon between page numbers is another page in the current volume.
- No rows were inserted for Turretin, van Mastricht, or Bavinck. Calvin’s full McNeill index still waits on shelf photos ([262](262-calvin-index-capture-rules.md)).

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/column-spans.ts` — ink histogram → 2 or 3 column spans. `splitImageIntoColumns` returns those crops in reading order.
- `scripts/ocr-index-eval/parse-index-line.ts`, `build-gold.ts`, `page-ocr.ts`.

## Open questions surfaced

- Four digit misses, both passes agreeing on the short number: Romans 1:3 → vol. 2 p. **320** read as 32; Romans 1:17 → **679** read as 675; Romans 1:18 → **433** read as 43; John 6:54 → vol. 3 p. **516** read as 5. The Verified pass on bulk capture has to catch dropped digits. Do not treat consensus agreement as proof of the page number.

## Surprises (read these before the next session)

- Decision **262** was taken by Calvin index capture rules while this session was open. This file is **263**.
- Page-02’s second pass sometimes omits `chapter_end` on a comma verse range. Consensus keeps both rows, so recall still hits and the UI flags the disagreement.
- `1—1:7` is chapter 1 (no verse), volume 1 page 7. It is not Romans 1:1.

## Carry-forward updates

- [x] components.mdc — no new UI component
- [x] AGENTS.md inventory updated (column split)
- [ ] new env vars — none (`ANTHROPIC_API_KEY` already used)
- [x] capture checklist shelf line for Turretin
