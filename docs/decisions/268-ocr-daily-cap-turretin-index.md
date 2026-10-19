# 268 — OCR daily cap for the Turretin index

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (Turretin scripture-index capture)

## Built

- `ocr_scripture_refs` daily cap raised from 50 to 300 calls per user per UTC day, and deployed.

## Decided

- Index mode spends 6 calls per leaf (3 columns × 2 passes). The vol. 3 scripture index is about 252 calls. The old cap of 50 stopped the run around leaf 8.
- 300 is one full pass plus retry room. It stays a ceiling. Auth, library access, and the book check are unchanged.
- Put the cap back to 50 after this index is saved, unless the next page-index set needs the same room.

## Schema changes

- None. `library_ocr_usage` already stores the count.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- On 2026-10-19 the counter stood at 3. The gold-gate leaves were read from the eval script, not through this cap.
- The cap resets at midnight UTC (7:00pm Chicago).

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no inventory change
- [ ] new env vars — none
- [x] PLAN.md
