# 274 — Turretin review gate + capture agent routing

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (systematics index capture)

## Built

- `scripts/ocr-index-eval/turretin-gate.ts` — `runGateChecks` + CLI; exit **0** pass / **2** fail / **1** missing files; optional `--parse [pdf]`.
- `turretin-review-summary.ts` — read-only open/corrected/skipped counts by reason prefix and printed page.
- Shared: `turretin-gold.ts`, `turretin-review.ts` (`corrected:` + `skip:`), `turretin-apocrypha.ts`, `turretin-parse-core.ts` (state machine; PDF/column code stays in `parse-turretin-text.ts`).
- npm: `turretin:parse`, `turretin:review-summary`, `turretin:gate`.
- Vitest under `scripts/ocr-index-eval/__tests__/` (vite `include` widened).
- Agent routing + copy-paste prompts: [docs/session-prompts/turretin-text-layer-workflow.md](../session-prompts/turretin-text-layer-workflow.md); checklist requires gate pass before insert.

## Decided

- **Apocrypha included in rows.json** (parser + gate only). Headings become `# book` with NRSV names (`Son of Sirach` → `Sirach`). Soft chapter table in `turretin-apocrypha.ts`. **No** `bible_books` migration this session — insert waits on vocab.
- Gold policy: fail if overall **&lt; 99.5%** **or any extra** on pp. 760/764/766. Misses are warnings. Known FineReader misses (`8:141`, `7:1749`) sit under the threshold but remain **open review** until `corrected:` — a full gate pass still needs those cleared (or they stay as open blocks).
- Review: any open block (raw present, no `corrected:` / `skip:`) → fail. Prior `corrected:`/`skip:` blocks are preserved across re-parse so fixes stay stable.
- Corrections apply **in place** (match `page:col:raw`), not appended at file end.
- Full-row validate: **fail** on `unknown_bible_book`, chapter/verse out of range, `out_of_canonical_order`, suspicious verse (&gt;100 non-Psalms). **Warn-only** `short_page_among_longer` (valid `1:10` beside `1:242` on one index line — skipped at accept time too).
- Agent routing: Composer/gates → Parker clears review → Opus import → Fable pre-`--apply` audit ([workflow doc](../session-prompts/turretin-text-layer-workflow.md)).

## Schema changes

- None (import + `bible_books` apocrypha deferred).

## New components / patterns added

- Turretin gate scripts under `scripts/ocr-index-eval/` (see Built).

## Open questions surfaced / next session

- Migration: apocrypha rows in `bible_books` (new testament value) + `BIBLE_BOOK_NAMES` / by-book / studies / MCP / Edge allowlist.
- Then `import-turretin-index.ts` with `routeIndexRowToVolume` + `stripVolumeFromPageToken` (dry-run default). No insert until `npm run turretin:gate` exits 0.

## Surprises (read these before the next session)

- Position-based `apocryphaZone` (p.753/754 col 1 only) was wrong: 2 Esdras starts p.753 col 3; 2 Maccabees spills into col 2. Heading-as-book fixes that.
- Gate must run on fresh `turretin:parse` output; stale `rows.json` without `printed_page` cannot gold-diff.
- Fresh parse (2026-10-19): gold **1023/1025** (99.805%), **0 extras**, **50** apocrypha rows, **130** open review. Full-file validate also fails **6× `out_of_canonical_order`** (same-chapter verse backtracks, e.g. Judges 14:20→14:6; 2 Macc 15:39→15:14) plus **444×** warn-only `short_page_among_longer`.

## Carry-forward updates

- [x] components.mdc — n/a
- [x] AGENTS.md — Scripts line for `turretin:*`
- [x] PLAN.md Recent decisions
- [ ] tracker Open Questions — Turretin insert waits on gate pass + vocab
