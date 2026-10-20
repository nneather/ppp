# 274 — Turretin review gate + capture agent routing

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (systematics index capture)

## Built

- `scripts/ocr-index-eval/turretin-gate.ts` — exit 0/2; optional `--parse` / PDF path; gold leaves pp. 760/764/766 ≥ 99.5%; open review blocks; lines chapter-backwards scan; full-file `validateIndexRows` + apocrypha policy.
- `turretin-review-summary.ts`, `turretin-gold.ts`, `turretin-review.ts`, `turretin-apocrypha.ts`, `turretin-parse-core.ts` (shared with parser).
- npm: `turretin:parse`, `turretin:review-summary`, `turretin:gate`.
- Vitest: `scripts/ocr-index-eval/__tests__/turretin-*.test.ts`.
- **Agent routing + copy-paste prompts:** [docs/session-prompts/turretin-text-layer-workflow.md](../session-prompts/turretin-text-layer-workflow.md); checklist step in [systematics-capture-checklist.md](../systematics-capture-checklist.md).

## Decided

- **Composer 2.5** — gates, tests, parser polish (no DB).
- **Parker** — clear `turretin.review.txt` until `npm run turretin:gate` passes.
- **Opus 5.5** — `import-turretin-index.ts` (dry-run default); only after gate green.
- **Fable 5.1** — read-only pre-`--apply` audit; does **not** replace Security Review on import or Bugbot when diff >400 LOC.
- Apocrypha: skipped in review is resolved; gate expects apocrypha rows in `rows.json` per `turretin-apocrypha.ts` policy (see gate session notes if policy shifts).

## Schema changes

- None (import session deferred).

## New components / patterns added

- Turretin gate scripts under `scripts/ocr-index-eval/` (see above).

## Open questions surfaced

- Import idempotency + smoke URLs — Opus session after gate pass.

## Surprises (read these before the next session)

- Gate must run on fresh `turretin:parse` output; stale or half-refactored `rows.json` fails gold with nonsense diffs.

## Carry-forward updates

- [ ] components.mdc — n/a
- [ ] AGENTS.md — optional one-line under Scripts when gate ships on `main`
- [ ] PLAN Session prompts — pointer to session-prompts (done)
