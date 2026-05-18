# 028 — OCR review UX + accuracy

**Date:** 2026-05-18  
**Module:** library (Session 9 OCR)  
**Tracker session:** ad-hoc (post-OCR review on scripture index pages)

## Built

- **[src/lib/components/scripture-reference-form.svelte](../../src/lib/components/scripture-reference-form.svelte)** — batch OCR review UX:
  - **Compact collapsed rows** (~44px) with `[✓] Include`, citation summary, confidence %, expand chevron; **auto-expand** only when `needs_review` or continuation needs book pick.
  - **Toolbar** when `rows.length > 1`: parsed / flagged counts, **Confirm N confident** (checks + green pulse), **Expand all**.
  - **Page-boundary separators** between OCR page images (`from page X of Y` + optional thumbnail); **amber left border** on first/last/only row per page.
  - **Mobile bible picker** — **Suggestions** chip grid (OCR pick + batch MRU + previous row) above full 66-book list when filter is empty.
  - **Save label** — `Save K of N` when subset checked; `rows_json` only includes **included** saveable rows.
- **[supabase/functions/ocr_scripture_refs/index.ts](../../supabase/functions/ocr_scripture_refs/index.ts)** — prompt: contiguous printed page ranges → one candidate with `page_start`/`page_end`; comma-separated pointers unchanged; edge-of-page → lower confidence. **Server normalizer** splits literal `14-15` / en-dash / em-dash in `page_start` when `page_end` empty.
- **Deployed** `ocr_scripture_refs` **2026-05-18**.

## Decided

- **Auto-expand flagged only** (user choice) — confident rows stay collapsed; reviewer taps strip or uses bulk confirm.
- **`included` checkbox** is the save contract (not implicit “has book + page”); bulk confirm sets `included: true` and collapses confident rows.
- **Decision file 028** (not 027) — [025](025-library-bundle-split.md) and [026](026-ocr-density-truncation.md) already occupy those numbers; [027](027-ocr-review-ux-and-accuracy.md) was not created.

## Schema changes

- None.

## New components / patterns added

- Batch OCR review: compact strip + page-boundary markers + bulk confirm — lives in `<ScriptureReferenceForm>` only.

## Verification

- [x] `npm run check` — clean (2026-05-18).
- [x] `npm run supabase:deploy-functions` — `ocr_scripture_refs` deployed.
- [ ] **Owner:** Re-OCR index page on book `c500a7ba-…` — Heb 11:13-16 + pages `14-15` should be **one** row (`page_start`/`page_end`), not two page-only rows.
- [ ] **Owner:** Mobile — scroll batch after OCR; confirm collapsed rows, separators, suggestions picker, **Save K of N**.
- [ ] **Owner:** Save batch; confirm DB rows match checked subset.

## Open questions surfaced

- **Desktop grid** still uses full row height when expanded; collapsed strip exists on `sm+` but expand-all opens every row. Acceptable for v1.
- **Two-pass OCR** (split photo, merge client-side) still reserved if a single image exceeds ~1,800 candidates ([026](026-ocr-density-truncation.md)).

## Surprises

- None in build; original pain was **UI surface area per row**, not missing OCR fields.

## Carry-forward updates

- [x] [AGENTS.md](../../AGENTS.md) — `ocr_scripture_refs` bullet
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated
