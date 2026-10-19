# 271 — Index OCR checker pass

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (two-model index check)

## Built

- Index mode pass 2 is Sonnet 5.5 (`claude-sonnet-5-5`), not a second Sonnet 4.6 read. Pass 1 stays Sonnet 4.6 (`ANTHROPIC_OCR_MODEL`, default `claude-sonnet-4-6`). Same six calls per leaf.
- `mergeIndexChecker` keeps the writer row when the page pointer matches, and ignores the checker's book name. A disagreed pointer stays one writer row, with the checker's reading in `review_note` (`checker 2:320`). A verse only the checker saw is one row with a blank book so the running-book carry applies.
- A one- or two-digit page among three-digit pages for the same verse and volume is flagged `short_page_among_longer`. That still fires when both models agree on the short token.

## Decided

- Do not merge both models' rows. The old two-pass merge kept the extras, which is how a high recall score still held wrong page numbers ([269](269-ocr-sonnet-gold-bakeoff.md)).
- The checker request omits `temperature` (Sonnet 5.5 rejects it) and sends `thinking: between_tools` with effort `high`.
- Ship the Edge Function with the app. An old client still merges on book name, so a 5.5 "Matthew" heading would duplicate a John column.

## Schema changes

- None.

## New components / patterns added

- `mergeIndexChecker` in `src/lib/library/scripture-ocr-consensus.ts`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Sonnet 5.5 cannot take `temperature: 0`. The checker body is a different request shape from the writer.
- Decision **270** was taken by the Turretin text-layer parser while this session was open. This file is **271**.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory updated
- [ ] new env vars — none (checker model is in code)
- [x] PLAN.md
