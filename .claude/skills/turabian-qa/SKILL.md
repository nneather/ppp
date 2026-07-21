---
name: turabian-qa
description: Turabian citation QA for the library module. Use when changing formatters, dispatch, or names; extend format.test.ts and spot-check Covenant fixtures.
---

# Turabian QA

## When to use

- Edits under `src/lib/library/turabian/`
- New `work_type` or genre dispatch branches
- Before fall-semester citation sign-off (August Wave 2)

## Steps

1. `npm run test` — all cases in `src/lib/library/turabian/__tests__/format.test.ts` incl. **Wave 2 fixtures** (`WAVE2_FIXTURES` in `fixtures.ts`; see [docs/library-turabian-fixtures.md](../../../docs/library-turabian-fixtures.md))
2. For each touched `CitationSourceType`, add **one** footnote + bibliography assertion (or extend existing fixture)
3. Spot-check against Covenant §17.1 examples in Claude Turabian skill / `formats.md` (owner reference)
4. On book detail: Copy Footnote + Copy Bibliography for one **edited_volume**, one **reference_work**, one **commentary-in-series**

## High-risk cases

| Case | Signal |
|------|--------|
| Jr./Sr. suffix | `Robert L. Hubbard Jr.` bib sort = Hubbard |
| 4+ authors | Note uses et al.; bib lists all (current behavior) |
| Reprint | Footnote `(orig; repr., …)` when `original_year` + `reprint_*` set |
| Dictionary article | Signed: abbreviated `in ABD, vol:page` or full essay-in-book (no `s.v.`); unsigned: `s.v.` |
| Short footnote | `formatFootnote(b, { shortForm: 'ibid', page })` |

## Do not

- Parse `person_label` only when `last_name` is on `BookAuthorAssignment` from loaders
