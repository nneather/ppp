# 179 — Essay bib locus before imprint (restore) + clear TDNT/ABD review notes

**Date:** 2026-07-24
**Module:** library
**Tracker session:** Wave 2 August QA Track B (ad-hoc)

## Built
- **Overturn [176](176-essay-bib-locus-after-imprint.md):** essay/chapter bibliography again puts `vol:page` (or page span) **after editors, before imprint** — Covenant Christman bib:
  `Christman, John. "Property Rights." In Encyclopedia of Applied Ethics, edited by Ruth Chadwick, 3:683–692. San Diego: Academic Press, 1998.`
- Footnotes unchanged (full notes still end with locus after `(Place: Pub, year)`; abbreviated ABD/TDNT notes already terminal).
- Migration `20260725031000_library_clear_stale_tdnt_abd_review_notes.sql`: clear stale `needs_review_note` on all TDNT + ABD volumes (`needs_review` already false). HALAT ISBN shelf notes left intact.

## Decided
- Owner confirmed Covenant bib order is locus-before-imprint; [176] was a misread of note-form Christman.
- Stale OL/Missing auto-notes on reminted TDNT/ABD are noise once publisher/year are set — clear the note field, not only the boolean.

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Book detail shows `needs_review_note` even when `needs_review = false` — remints that only flip the flag leave zombie banners.

## Carry-forward updates
- [x] components.mdc — n/a
- [x] AGENTS.md — n/a
- [x] new env vars — none
- [x] tracker — n/a
