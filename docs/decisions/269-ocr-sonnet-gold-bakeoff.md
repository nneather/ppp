# 269 — Sonnet bake-off on the Turretin gold gate

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (check the page-index gold gate)

## Built

- Nothing shipped. One independent read of the nine saved Turretin column crops (`scripts/ocr-index-eval/images/page-0N-colN.png`) with the gold-gate prompt, thinking off.
- Models: Sonnet 4.5 (`claude-sonnet-4-5-20250929`), Sonnet 4.6 (`claude-sonnet-4-6`, the production default), Sonnet 5 (`claude-sonnet-5`), Sonnet 5.5 (`claude-sonnet-5-5`). Sonnet 5 and 5.5 reject `temperature`. Sonnet 5 ran with thinking disabled. Sonnet 5.5 ran with `thinking: between_tools` and effort `high` (no up-front thinking).

## Decided

- Keep **`claude-sonnet-4-6`** for index OCR. A fresh one-pass read was **1,018/1,025 exact (99.317%)**. Its seven misses are comma pairs read as verse ranges (`17:26` → `17:26–17:26`, `1:1, 2` → `1:1–2`), not dropped digits.
- **Sonnet 5.5 is the best auditor of the numbers and a bad book labeler.** Pointer fields (chapter, verse, page, volume), ignoring book name: **1,025/1,025, zero extra keys.** Exact match fell to **904/1,025** because page-03 column 2 (John, no heading on the crop) was labeled Matthew for all 121 rows.
- Sonnet 4.5 was **819/1,025 (79.9%)**. It drops the volume on many `vol:page` tokens. Sonnet 5 was **414/1,025 exact** and **879/1,025** on pointers. It invents a book on continuation columns (Exodus, Genesis, Deuteronomy) and returned an empty candidate list twice on page-03 column 3.
- The published two-pass Sonnet 4.6 gate ([263](263-systematics-page-index-gold-gate.md), 1,021/1,025) did agree with itself on four short page numbers. Independent reads got the gold digits: Romans 1:3 → **320** (gate had 32), 1:17 → **679** (675), 1:18 → **433** (43), all four models; John 6:54 → **516** (gate had 5), Sonnet 4.6 and 5.5. The hand gold is the page. Two passes of one model locking a short digit is not a check.
- Do not switch the Edge default to Sonnet 5.5. A wrong book name on a headingless column would file a whole column under the wrong book. Blank `bible_book` plus the running-book carry is the behavior 4.6 already has.

## Schema changes

- None.

## New components / patterns added

- None. Bake-off output stayed in `/tmp`.

## Open questions surfaced

- None. Production model stays Sonnet 4.6.

## Surprises (read these before the next session)

- Exact-match recall hides extras. The published two-pass file has 31 pointer keys that are not in the gold. Sonnet 5.5 added none.
- A fresh Sonnet 4.6 pass did not repeat the four dropped digits. Temperature 0 is not a frozen read.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no inventory change
- [ ] new env vars — none
- [x] PLAN.md
