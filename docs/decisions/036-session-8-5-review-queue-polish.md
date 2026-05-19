# 036 — Library Session 8.5 — Review queue polish (swipe + haptic)

**Date:** 2026-05-19  
**Module:** library  
**Tracker session:** Session 8.5

## Built

- **`src/lib/library/review-swipe.ts`** — touch-only pointer capture; ~80px horizontal threshold; vertical scroll wins when `|dy| > 40` before threshold; ~800ms stroke cap; bails on interactive targets (`input`, `button`, `a`, etc.).
- **`/library/review`** — right swipe → `form.requestSubmit()` (same `saveReviewed` + `saveSubmit()` path as Confirm button); left swipe → `skipCurrent()` (no DB write). Field-wrong stays button-only (inside interactive bail list).
- **Confirm feedback** — `navigator.vibrate(15)` on success (swipe fires once before submit; button path fires in `saveSubmit` success); ~200ms emerald `CheckCircle2` overlay before `advance()`.
- **Microcopy** — hide “N this session” on mobile header; empty state “N books confirmed in this session”; mobile hint “Swipe right to confirm · left to skip”.

## Decided

- **Touch-only swipe** — `pointerType === 'touch'` so desktop mouse drags never confirm/skip accidentally.
- **No swipe on Field wrong** — link/button in interactive selector; only Confirm (right) and Skip (left) gestures.
- **Single save path** — swipe confirm uses `requestSubmit()` on the existing enhanced form; no duplicate server action.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/review-swipe.ts` — reusable swipe controller for review card (optional reuse on other queue UIs).

## Open questions surfaced

- **iOS Safari PWA hands-on smoke** — owner to verify swipe + sticky buttons + Esc/delete dialog on device (trip QA runbook §A row 3).

## Surprises

- None.

## Carry-forward updates

- [ ] Tracker Session 8.5 acceptance — owner phone smoke
- [ ] AGENTS.md inventory — add `review-swipe.ts` if reused elsewhere
