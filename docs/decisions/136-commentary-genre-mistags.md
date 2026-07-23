# 136 — Commentary genre mistags (Calvin + Romans)

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc

## Built

- Migration `20260723212212_library_commentary_genre_mistags.sql`:
  - **Calvin CC vol 19** (*Acts 14–28; Romans 1–16*) `Acts and Paul` → `Commentary` (+ `reading_status` → `reference` to match siblings). All **22** CC vols now `Commentary`.
  - Same mistag on five Romans series volumes → `Commentary`: BECNT, EGGNT, NIBC, NICNT (*The Letter to the Romans*), ZECNT.
  - NICNT *The Epistle to the Hebrews* `Biblical Reference` → `Commentary`.
- Verified: ESVEC was already all `Commentary` (12/12). The John–Acts “Also on the shelf” oddity was Calvin vol 19 (covers Acts), not ESVEC.

## Decided

- `/sermons/by-book` splits coverage by genre: `Commentary` → Commentaries list; anything else → **Also on the shelf**. NT/OT subject genres (`Acts and Paul`, etc.) must never win over verse-by-verse series volumes ([library-recommend-genre](../../.claude/skills/library-recommend-genre/SKILL.md)).
- Left intentional non-Commentary coverage alone: Carson *Showing the Spirit* (`Applied Theology` on 1 Cor 12–14); IVP BBC / *New Bible Commentary* as Biblical Reference ([088](088-commentary-bible-coverage-cleanup.md)); thematic / confessional “commentary” titles without series.

## Schema changes

- DML only — no typegen.

## Open questions surfaced

- None.

## Surprises

- Six of seven `Acts and Paul` books with bible coverage were the same mistag pattern (Romans + Calvin vol 19) — likely Goodreads/import subject bleed into `genre`.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
