# 253 — Systematics by passage (S1–S5 scaffold)

**Date:** 2026-10-19
**Module:** library / studies / mcp
**Tracker session:** ad-hoc (plan: Systematics by passage)

## Built

- **S1 — Outline + band**
  - Migration `20261019210000_book_outline_sections.sql` — `book_outline_sections` + `search_scripture_refs` v3 (`book_genre`, `book_volume_number`, `series_id`, `series_name`). Pushed + gen-types.
  - Pure `outline.ts` + tests; `systematics-loaders.ts`; `outline-actions.ts` (CRUD + TSV paste).
  - `/library/search-passage` **Systematic theologies** band + `<SystematicsOnPassage>`.
  - Book detail Outline panel + `<OutlineSectionForm>` (single + paste).
  - Smoke data: 1 Thess index + outline rows for Turretin II, van Mastricht 2/3/4, Bavinck RD 4.
- **S2 — Sermon / paper workspace + MCP**
  - `loadStudyWorkspace` returns `systematics`; `<StudySourcesPanel>` renders with Attach.
  - MCP `list_systematics_for_passage` (smoke OK).
- **S3 — OCR index mode**
  - Edge `index_mode` prompt + `volume` on candidates; second pass (`index_pass=2`) uses a stricter prompt. Deployed.
  - Index mode only: 3000px long edge, column split, two OCR passes, `mergeOcrConsensus`, `flagIndexCandidates` (structural + consensus → `review_note` / confidence ≤ 0.7). A failed pass falls back to the pass that returned. Verified checkbox clears `needs_review` on that page's draft rows. Set mode routes vol:page batches per volume.
- **S4 — Gold eval harness**
  - `scripts/ocr-index-eval/` (compare.ts + README). Gate: ≥99.5% before bulk capture. Gold pages not transcribed yet (owner).
- **S5 — Capture checklist**
  - `docs/systematics-capture-checklist.md`. Bulk OCR deferred until gold gate passes.

## Decided

- Structure locked in [252](252-systematics-by-passage-session-0.md); this session implements it.
- Systematic band pulls index hits with `genre = Systematic Theology`; outline join is app-layer.
- Set routing: explicit volume → outline page bounds → default book; strip `vol:` before save.
- Bulk capture remains owner labor after gold eval.

## Schema changes

- `20261019210000_book_outline_sections.sql`

## New components / patterns added

- `outline-section-form.svelte`, `systematics-on-passage.svelte`
- `outline.ts`, `systematics-loaders.ts`, `outline-actions.ts`
- `scripture-ocr-consensus.ts`, `scripture-index-validate.ts`, `image-column-split.ts`, `systematics-set-routing.ts`

## Open questions surfaced

- Shelf checks from [252] still open (Turretin index location, Bavinck cumulative?, Calvin continuous pagination?, van Mastricht chapter texts).

## Surprises (read these before the next session)

- Decision 250–251 were already used; Session 0 is 252, this build is 253.
- Smoke MCP for 1 Thess 1:5 returns Turretin + another set (pointer_count 2) — van Mastricht/Bavinck rows may need overlapping verse ranges to appear on a single point query.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] PLAN.md refreshed
- [ ] new env vars — none
- [ ] Owner: transcribe 3 gold index pages → run `npx tsx scripts/ocr-index-eval/compare.ts` → bulk capture per checklist
