# 119 — Commentary consistency Batch 3

**Date:** 2026-07-22
**Module:** library
**Tracker session:** ad-hoc — commentary metadata uniformity pass (cont.)

## Built

- Migration `20260722221409_library_commentary_consistency_batch3.sql`:
  - **SP** Luke → vol `3`; **ACCS** Mark → `2`, 1–2 Corinthians → `7`.
  - Sarna *Genesis* stays **JPSTC**; imprint/ISBN → JPS (`Jewish Publication Society`, 2001, `9780827603264`) — was Schocken 1966 stub.
  - Berlin title → `Esther`.
  - **NIB** Vol X title → `Acts–1 Corinthians` (ESVEC-style content range; vol `10` unchanged).
  - Beale subtitle → `A Commentary on the Greek Text`.

## Decided

- Sarna is JPS Torah (owner Amazon confirm) — fix metadata, do not detach.
- NIB multi-book volumes follow ESVEC range titles, not “The New Interpreter’s Bible Vol N”.
- Beale subtitle uses title case including **Commentary**.

## Schema changes

- DML only — no typegen.

## Open questions surfaced

- End-pass lists still open: EGGNT imprint mess, Spurgeon Treasury under SS, standalones, Calvin within-series polish, Jobes BECNT POD publisher.

## Carry-forward updates

- [x] PLAN.md refreshed
