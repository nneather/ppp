# 160 — TDNT / HALAT consistency + LSJ + abridged Liddell & Scott

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc (August QA Track B / reference-work hygiene)

## Built
- Migration `20260724233000_library_tdnt_halat_lsj_consistency.sql` (applied hosted):
  - **TDNT** (10 vols) — Eerdmans / Grand Rapids, MI + `publisher_id`; English print years 1964–1976; `total_volumes=10`; cleared junk publisher/ISBN; series `include_in_citation=false`
  - **HAL → HALAT** — renamed series abbr/name to German HALAT; cleaned titles (volume out of title); `total_volumes=5` (owns 1–4); Brill/Leiden; cleared `needs_review`
  - **LSJ** — new *A Greek-English Lexicon* (Liddell/Scott + Jones ed.; 9th with revised supplement; Clarendon 1996; series abbr `LSJ`)
  - **Abridged** — fixed null first names → Henry George Liddell / Robert Scott; full abridged title; `work_type=reference_work`; cleared `needs_review`
- Follow-up `20260724233500_library_lsj_edition_clarendon_fix.sql` — edition pass-through string + Clarendon free-text (unlinked OUP so Turabian does not prefer registry name)

## Decided
- TDNT years = English Eerdmans first-print years (vol 5 = 1968, not reprint 1979); ISBNs left null
- German set abbr **HALAT** (not HALOT); no vol-5 row; `total_volumes=5` for set completeness
- LSJ = full 9th + 1996 revised supplement defaults; abridged kept as separate shelf entry
- Self-named / abbreviation-cited series (`TDNT`, `HALAT`, `LSJ`): `include_in_citation=false` so volume cites do not double the series segment (essay path still uses `series_abbreviation`)

## Schema changes
- DML-only migrations above — no type regen

## New components / patterns added
- None

## Open questions surfaced
- TDNT volume Turabian path (`reference-work-edited`) still omits Bromiley translator in the volume footnote — pre-existing; essay abbr form is fine. Fix formatter if volume-level TDNT cites matter.
- LSJ bibliography join is slightly tight between edition and place (`…supplement Oxford`) — formatter punctuation; defer unless it shows up in writing.

## Surprises (read these before the next session)
- HAL rows were German HAL (1967–1990), not English HALOT (1994–2000) — years proved it
- Edition strings that contain `ed.` mid-string but do not *end* with `ed.` get a second `ed.` from `formatEditionSegment` — store `…edition…` for pass-through
- Decision **159** already taken twice (classwork Session 2 + PLAN trim) — this entry is **160**

## Carry-forward updates
- [x] components.mdc — N/A
- [x] AGENTS.md inventory — N/A (DML only)
- [x] new env vars documented — none
- [x] tracker Open Questions — N/A (ad-hoc)
