# 194 — Library ISBN integrity (Collins + duplicate rows)

**Date:** 2026-08-05
**Module:** library
**Tracker session:** ad-hoc follow-up to ISBN × Open Library audit

## Built
- Migration `20260805200151_library_isbn_integrity_collins_and_dups.sql` (hosted push):
  - Collins *Genesis 1–4* ISBN `9781596380360` (invalid check digit) → **`9780875526195`** (P&R).
  - Five exact duplicate ISBN+title pairs: keep older row, `copy_count = 2`, soft-delete newer.

## Decided
- Owner: Open Library title/author disagreements are **not** grounds to rewrite library ISBNs — catalog wins.
- Collins: do **not** “fix” the check digit to `9781596380363` (that is Clowney *How Jesus Transforms the Ten Commandments*).
- Duplicate same-title rows = two physical copies → `copy_count = 2`, not two catalog rows.
- Shared ISBN across **different** titles (Lost Tales 1/2; Foundation / Second Foundation) deferred until shelf barcode.

## Schema changes
- `20260805200151_library_isbn_integrity_collins_and_dups.sql` — DML only

## New components / patterns added
- `scripts/library-isbn-audit/auditIsbn.ts` — optional re-run OL cross-check (Session Pooler URL + SSL); not wired to `package.json`.

## Open questions surfaced
- Shelf barcodes for Lost Tales 1 vs 2 (`9780780715462` shared) and Foundation vs Second Foundation (`9789993068808` shared).
- Optional later: Calvin *Harmony of Exodus…* appears twice with null ISBN — not in this pass.

## Surprises (read these before the next session)
- OL often maps commentary series ISBNs to the wrong volume or series title; treat as noise unless local checksum / duplicate-ISBN signals fire.
- Check-digit-only “repair” of a mistyped ISBN can land on an unrelated P&R title in the same number range.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a (script is optional CLI)
- [ ] tracker Open Questions — n/a
