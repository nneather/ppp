# 102 — August QA Track A: Covenant fixture validation

**Date:** 2026-07-21
**Module:** library
**Tracker session:** Wave 2 August shelf QA — Track A (Covenant strings; Track B physical shelf still open)

## Built

- Validated all 20 Wave 2 fixture expected strings against the [Covenant Turabian books guide](https://covenantseminary.libguides.com/turabian/books) (§17.1 / §17.9.1), not just re-running vitest.
- **Formatter fix** in `article.ts`:
  - Signed articles with `series_abbreviation` → Covenant abbreviated form `Author, "Entry," in ABD, 1:835.` (gate is abbreviation only; translator no longer required — closes 065 gap).
  - Signed / chapter full form → Covenant essay-in-book order `in Title, ed. Name (pub), loc.` — dropped erroneous `s.v.` on signed entries (row 17 title duplication).
  - TDNT notes align: `…, in TDNT, 4:100.`
- Updated `WAVE2_FIXTURES`, `format.test.ts`, `docs/library-turabian-fixtures.md`.

## Decided

- **Abbreviated when possible** for well-known signed dictionaries (ABD / TDNT / NIDOTTE-style) — Parker.
- **Switch to Covenant title-then-`ed.` order** for chapter + signed full cites — no seminary reason to keep `Editor, ed., Title`. Rejected: keep old order for paper continuity.
- **Row 8 (Lechler)** already matched Covenant’s own multi-element example — prior “aspirational ordering” worry in [056](056-library-wave2-phase0.md) was unfounded.
- **Intentional keep (not bugs):**
  - Row 13: note uses series **abbreviation** (`WBC`) — [032](032-edited-works-and-citation-accuracy.md); Covenant examples often spell the series out.
  - Row 4 bib lists 4 authors in the fixture; Covenant’s Schultze example lists 6 — fixture truncation, form correct (`et al.` in note).
  - Page numbers / subtitle length differ from Covenant examples where the guide cites a different locus — form still matches.

## Schema changes

- None. Owner data: ABD volumes should already carry `series_abbrev` from Pass 1 import (`migrationOverrides`); confirm on ABD vol 1 smoke that copy yields `in ABD, 1:…`.

## New components / patterns added

- None (formatter-only).

## Open questions surfaced

- **Track B** — physical shelf verification of all 20 rows — Parker — Madison / August.
- Optional: omit bibliography for well-known ABD/TDNT (Covenant “notes only”) — left as-is; signed bib still useful for paper merge ([065](065-writing-workflow-review.md) Q7).

## Surprises (read these before the next session)

- Covenant’s signed abbreviated example includes **`in`** before the abbreviation (`in NIDOTTE, 1:520.`); our prior TDNT form omitted `in`.
- ABD seed essays already existed; abbreviated cite only fires when the parent book’s `series_abbreviation` is hydrated into `BookCitationInput` (same path as BDAG/TDNT).

## Carry-forward updates

- [x] `docs/library-turabian-fixtures.md` updated (rows 17–19)
- [x] PLAN.md refreshed (Track A done; Track B remains)
- [ ] components.mdc — N/A
- [ ] AGENTS.md — optional one-line on abbreviated `in ABBR` (skip unless inventory pass)
- [ ] new env vars — none
