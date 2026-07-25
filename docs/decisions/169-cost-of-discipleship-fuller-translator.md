# 169 — Cost of Discipleship R. H. Fuller translator

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (follow-up to [168](168-cost-of-discipleship-scribner-1995.md))

## Built
- Migration `20260725001200_library_cost_of_discipleship_fuller_translator.sql` (applied hosted): create person **R. H. Fuller**; attach as `translator` sort_order 2 on *The Cost of Discipleship* (`1a886166-…`)

## Decided
- Credit **R. H. Fuller** only — title page also notes “some revision by Irmgard Booth”; Booth is a reviser, not stored as co-translator
- Initials-as-first: `first_name = 'R. H.'` (matches `J. N. D.` / `C. S.` people naming)

## Schema changes
- DML-only — no type regen

## New components / patterns added
- None

## Open questions surfaced
- None (add Booth later only if a writing surface wants reviser credit)

## Surprises (read these before the next session)
- None

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A
