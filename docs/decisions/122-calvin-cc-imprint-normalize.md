# 122 — Calvin CC imprint normalize (Baker set only)

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — follow-up to [121](121-commentary-consistency-batch5.md)

## Built

- Migration `20260723151212_library_calvin_cc_imprint_normalize.sql`:
  - Banner Genesis (vol 1), Eerdmans Psalms 93–150 (vol 6), CTS 1845 Harmony (vol 16) → `Baker Books` / `1993`; cleared shelf `needs_review`.

## Decided

- Owner owns **one** Calvin commentary set (Baker 22-vol). The three non-Baker imprint rows were erroneous metadata for set volumes 1/6/16, not extra copies.
- **Normalize in place** rather than soft-delete — those three rows are the only DB entries for those volume slots; deleting would punch holes in the set.

## Schema changes

- DML only — no typegen.

## Carry-forward updates

- [x] PLAN.md refreshed
