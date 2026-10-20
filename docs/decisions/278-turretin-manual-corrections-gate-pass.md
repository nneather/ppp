# 278 — Turretin manual corrections + gate pass

**Date:** 2026-10-19  
**Module:** library (systematics index)  
**Tracker:** [POS_Library_Build_Tracker.md](../POS_Library_Build_Tracker.md) — Turretin text-layer path

## Built

- `turretin-manual-corrections.ts` — Parker-validated Tier A/B/C fixes keyed `page:col:raw`; merged on every `turretin:parse`.
- Glued multi-ref parse (`splitGluedIndexLine`) for FineReader column glue (Jeremiah, Deuteronomy, etc.).
- Review dedupe (`dedupeReviewBlocks`) + `turretin-prune-review.ts`; skip no longer wins when `corrected:` is present.
- OCR normalization tweaks (`1345` → `13–15`, `1042` → `10–12`, `740` → `7–10`, etc.) and 1 Cor **12:13** printing fix.
- **Gate:** `npm run turretin:gate` PASS — gold 1025/1025, 0 open review.

## Decided

- Genesis **18** chapter line (`18—1:185…`) and **18:1–15** are separate index rows; both kept.
- Glued `1:1042` on printed **p.777 col 3** is **1 Peter** `1:10–12` (not Philippians; no `1:1042` in Philippians block).
- Durable hand-fix file is `turretin-manual-corrections.ts`, not review-file churn alone.

## Schema changes

- None.

## New components / patterns added

- `scripts/ocr-index-eval/turretin-manual-corrections.ts`, `turretin-prune-review.ts`, `turretin-line-normalize.ts` (if not already tracked).

## Open questions surfaced

- None — DB import still blocked until Parker explicitly runs bulk capture after gate.

## Surprises

- Review blocks with both `corrected:` and legacy `skip:` silently dropped imports until skip-key logic ignored skip when corrected exists.

## Carry-forward updates

- [x] AGENTS.md inventory — manual corrections called out in README + [274](274-turretin-review-gate-and-routing.md) path
- [ ] components.mdc — N/A
