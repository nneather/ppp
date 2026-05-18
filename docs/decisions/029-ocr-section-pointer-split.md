# 029 — OCR semicolon-separated section pointers (patristic index)

**Date:** 2026-05-18  
**Module:** library (Session 9 OCR)  
**Tracker session:** ad-hoc (Augustine *De Trinitate* index format)

## Built

- **[supabase/functions/ocr_scripture_refs/index.ts](../../supabase/functions/ocr_scripture_refs/index.ts)**:
  - **Prompt** — `page_start`/`page_end` described as source location (page number or patristic book/section pointer, e.g. `VI, 7`). New rule: semicolon-separated pointers after one Bible ref → **one Candidate per pointer**, same bible/chapter/verse, pointer verbatim in `page_start`.
  - **`splitSemicolonPointers`** — server normalizer splits `page_start` on `;` when the model still returns one lumped string (e.g. `VI, 7; VIII, 10; XV, 30` → three candidates). Wired in `parseExtractPayload` after `normalizeCandidate` + `normalizePageRangeInCandidate`.
- **Deployed** `ocr_scripture_refs` **2026-05-18**.

## Decided

- **Server-side split** (not client) so DB rows are correct from any consumer; mirrors contiguous page-range normalizer in [028](028-ocr-review-ux-and-accuracy.md).
- **No schema / UI change** — `page_start` TEXT already accepts Roman section tokens; display still uses `p.` prefix from `formatScriptureRefPageSummary` (cosmetic only).

## Schema changes

- None.

## New components / patterns added

- `splitSemicolonPointers` in OCR Edge Function — second “one candidate → many” post-processor after page-range split.

## Verification

- [x] `npm run check` — clean (2026-05-18).
- [x] `npm run supabase:deploy-functions` — `ocr_scripture_refs` deployed.
- [ ] **Owner:** OCR one Augustine index page with `Matt 22:40 — VI, 7; VIII, 10; XV, 30` → expect **three** draft rows, same Bible ref, `page_start` = `VI, 7` / `VIII, 10` / `XV, 30`.
- [ ] **Owner:** Regression on Arabic-page index book (`c500a7ba-…`) — comma lists and `14-15` ranges unchanged.

## Open questions surfaced

- **`1.7.4`-style dotted refs** — stored as single `page_start` string; no multi-part split. Deferred.
- **Per-book citation-style hint** to OCR (e.g. “this book uses Roman section refs”) — not built; prompt is global.

## Surprises

- None at build time.

## Carry-forward updates

- [x] [AGENTS.md](../../AGENTS.md) — `ocr_scripture_refs` bullet
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated
