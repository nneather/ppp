# 297 — Calvin scripture index import

**Date:** 2026-10-23
**Module:** library
**Tracker session:** ad-hoc

## Built

- Imported McNeill’s Index I from the Logos export `Battles Institutes Scripture Index.docx` (not shelf photos). `npm run calvin:import` is a dry run; `--apply` writes.
- 6,672 live `scripture_references`: 4,044 on Battles volume 1, 2,628 on volume 2. Each locator hit exactly one outline chapter (I.1–III.19 on vol 1, III.20–IV.20 on vol 2).
- 103 rows `needs_review`: Prefatory Address (`PA 2`–`PA 8`, 102) plus one ambiguous Acts line (`14:16–17/15–16/p`). All 103 are on volume 1.
- Retired the 7 practice rows. A second dry run inserted 0 and retired 0.
- Audit log: 6,672 inserts and 7 updates on `scripture_references`.

## Decided

- This export is the capture. Arabic locators stay as printed (`3.2.15`). The chapter outline already joins roman or arabic.
- Repeated identical lines stay separate rows. A same-chapter verse list (`5:1, 4`) becomes one row per verse. A contiguous chapter list stays one span, with `chapter_end` set so `compute_verse_abs` keeps `verse_end`.
- English verse is the stored passage. A Vulgate twin (`4:6/4:7`), `ff`, a half-verse (`16:2a`), and `par 12` sit on `review_note` and do not set `needs_review`.
- `PA` is not a Battles section. Those rows are stored on volume 1, where the Prefatory Address is printed, and flagged.
- Canticles → Song of Songs. Ecclesiasticus → Sirach. Esther, Nahum, 2 John, and 3 John are absent from the index.
- Soft-deleted twins stay deleted. Live rows whose passage + locator are not in the file are retired. The volumeless *Institutes* book is not in the McNeill/Battles series and got no rows.

## Schema changes

- None.

## New components / patterns added

- `scripts/ocr-index-eval/calvin-index-parse.ts` — docx paragraphs → citations.
- `scripts/ocr-index-eval/calvin-index-plan.ts` — outline routing, dedupe, retire.
- `scripts/ocr-index-eval/import-calvin-index.ts` — `npm run calvin:import`.

## Open questions surfaced

- The index key defines French 1560 (`VG`) and Latin 1559 (`VL`), and this export almost never uses them as locators. If the printed volume has those cites, they are not in the file.
- The 103 `needs_review` rows are listed in [docs/calvin-index-needs-review.md](../calvin-index-needs-review.md) for a shelf pass.
- van Mastricht’s source is still not chosen ([267](267-systematics-index-sources.md)).

## Surprises (read these before the next session)

- The practice row 1 Thessalonians 1:5 → `IV.1.6` does not match this index. The file has 1:5 → `3.2.15` and 1:4–5 → `3.2.11`. `4.1.6` is 1 Thessalonians 3:5, among other verses. Logos links agreed with the locators except Genesis 47:10 `l.11.15`, which the link corrects to `1.11.15`.
- Decision 259’s “short outline” note is stale. Both volumes already had a chapter outline, so no TOC paste was required. Book-level nodes (`III`) do not parse as section locators, so volume 2’s Book III heading does not steal chapters volume 1 owns through III.19.
- Decision 294 was taken by sermon-commentary-shelf while this session was open. This file is **297**.

## Carry-forward updates

- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] components.mdc — no new component
- [ ] new env vars — none
