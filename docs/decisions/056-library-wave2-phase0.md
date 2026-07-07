# 056 — Library Wave 2 Phase 0 — fixture-first Turabian

**Date:** 2026-07-06
**Module:** library
**Tracker session:** Wave 2 Phase 0

## Built

- **20-row QA fixture set** — [docs/library-turabian-fixtures.md](../library-turabian-fixtures.md) with expected footnote/bibliography strings per Covenant §17.1, pass/fail status, and session sequence.
- **Executable fixtures** — `src/lib/library/turabian/__tests__/fixtures.ts` (`WAVE2_FIXTURES`) + `describe('Wave 2 fixtures')` in `format.test.ts` (pass rows = `it`; gap rows = `it.fails`).
- **Gap analysis:** 15 pass / 5 fail — rows 16–20 (unsigned BDAG `s.v.`, signed ABD article, TDNT abbreviated article, chapter-in-edited-volume, short-footnote casing/title).
- **`EssayCitationInput.authors`** — optional type field on article input (Session 1 contract; not yet consumed by formatters).

## Decided

- **Fixture encoding:** both reviewable markdown doc and vitest cases; known gaps stay green via `it.fails` until Session 1 flips them to `it`.
- **Session 1 scope:** formatters + loaders first; seed ~5 real essay rows via SQL; **no essays CRUD UI** until Session 2.
- **Session sequence:** 1 formatters → 2 essays UI → 3 megacomponent split → 4 `.docx` export → August physical shelf QA.
- **Article-level citations IN scope** for fall semester (reverses Session 8 tracker deferral; aligns with PLAN.md 2026-06-04 decision).
- **TDNT abbreviated style** may slip to Session 2 if Session 1 runs long (row 18 marked fail; not a Session 1 hard gate).

## Schema changes

- None (Phase 0 is fixture + test only; essay seed SQL ships Session 1).

## New components / patterns added

- [docs/library-turabian-fixtures.md](../library-turabian-fixtures.md) — canonical 20-row QA list.
- `src/lib/library/turabian/__tests__/fixtures.ts` — shared `WAVE2_FIXTURES` for Session 1+.
- Wave 2 fixture test harness in `format.test.ts` — flip `it.fails` → `it` as formatters ship.

## Open questions surfaced

- **Short-form registry in papers** — deferred to Session 1 (row 20); no cross-footnote state in Phase 0.
- **Physical shelf metadata** — August verification; Phase 0 strings drafted from tracker/test corpus.

## Surprises (read these before the next session)

- Row 8 (Lange Acts) passes today with `ed.` before `trans.` in footnote and `2 vols.` without per-volume `Vol. N` in bib — fixture documents **current** output, not aspirational Covenant ordering.
- Reprint bibliography **does** work (row 10) — [033](033-library-pm-review-may-2026.md) surprise was overstated for footnote+bib pair; only untested at ship time.
- `formatEssayFootnote` unsigned path duplicates article title in `s.v.` clause — acceptable for unsigned ABD-style entries but wrong for BDAG abbreviation-only form (row 16).

## Carry-forward updates

- [ ] components.mdc updated — N/A (no new UI components)
- [ ] AGENTS.md inventory updated — optional pointer to `library-turabian-fixtures.md` on next AGENTS touch
- [ ] new env vars documented — N/A
- [x] tracker Wave 2 section updated
- [x] PLAN.md refreshed
