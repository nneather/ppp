# Turretin scripture index — text layer workflow

PDF (local): `/Users/Neal/Documents/ppp/PDFs for parsing/Institutes-of-Elenctic-Theology-Francis-Turretin-vol-3-scripture-index.pdf`

Background: [270](../decisions/270-turretin-text-layer-parser.md), [263](../decisions/263-systematics-page-index-gold-gate.md), [systematics-capture-checklist.md](../systematics-capture-checklist.md).

## Agent routing (Cursor)

| Step | When | Model | New chat? |
|------|------|--------|-----------|
| **1. Gates + tooling** | First build | **Composer 2.5** | Yes |
| **2. Manual review** | Parker clears `turretin.review.txt` | *(human)* | — |
| **3. DB import** | Only after `npm run turretin:gate` passes | **Opus 5.5** | Yes |
| **4. Pre-apply audit** | After Opus diff, before Parker runs `--apply` | **Fable 5.1** | Yes (read-only) |

**Also (any model):**

- Diff **>400 LOC** before push → **Bugbot** subagent ([workflow](../../.cursor/rules/workflow.mdc)).
- Phase 3 touches RLS / service-role import → **Security Review** subagent before push (not replaced by Fable).

**Disagreement note:** Fable is for a final read-only pass (gate semantics, idempotency, Manual for Parker, missed edge cases). It does not replace Security Review on the import script.

---

## Step 1 — Composer 2.5: gates + tests (no DB apply)

**Cursor:** New chat → **Agent** mode → model **Composer 2.5** (not Plan-only; not Ask). Paste the block below as the first message.

```
Session: library — Turretin text-layer review gates
Tracker: ad-hoc systematics capture; docs/decisions/270-turretin-text-layer-parser.md, docs/decisions/274-turretin-review-gate-and-routing.md
Read: AGENTS.md, .cursor/rules/workflow.mdc, docs/decisions/270-turretin-text-layer-parser.md, docs/decisions/263-systematics-page-index-gold-gate.md, docs/decisions/274-turretin-review-gate-and-routing.md, docs/systematics-capture-checklist.md, docs/session-prompts/turretin-text-layer-workflow.md, scripts/ocr-index-eval/parse-turretin-text.ts, scripts/ocr-index-eval/turretin-gate.ts, scripts/ocr-index-eval/turretin-parse-core.ts, scripts/ocr-index-eval/compare.ts, scripts/ocr-index-eval/build-gold.ts, src/lib/library/scripture-index-validate.ts

Supabase: hosted only. Do not insert scripture_references. Do not deploy Edge Functions. Do not change parse-turretin-text column/book logic unless a test proves a bug.

Goal: Ship machine-checkable gates so “review clear + gold leaves OK” is one command (`npm run turretin:gate`). If gate scripts already exist in the tree, finish/polish them (do not rewrite from scratch); fix any regression so a fresh parse on Parker’s PDF reproduces ~1023/1025 on gold leaves per 270.

PDF (local): /Users/Neal/Documents/ppp/PDFs for parsing/Institutes-of-Elenctic-Theology-Francis-Turretin-vol-3-scripture-index.pdf

Deliver:
1. turretin-gate.ts (+ --parse), turretin-review-summary.ts, package.json scripts, vitest fixtures (Luke→John pending flush, apocrypha, 8:141, 1:10 among 1:242)
2. scripts/ocr-index-eval/README.md gate section; finalize docs/decisions/274-turretin-review-gate-and-routing.md; PLAN.md (Recent decisions + repo gate date if you run check/test)
3. Run: npm run turretin:gate -- --parse "<PDF path>" if file exists; record pass/fail honestly (gate may still FAIL until Parker clears review — that is OK if tooling is correct)

Gate fail if: gold leaves < 99.5% or extras on pp. 760/764/766; open review (apocrypha skipped = resolved per 274); full-file validate failures; chapter backwards per book; apocrypha policy violations; duplicate compare keys.

Acceptance:
- [ ] npm run check passes
- [ ] npm run test passes (incl. turretin-* tests)
- [ ] npm run turretin:gate runs without crash on current artifacts

End-of-session: decision 274 accurate; copy-paste commit message; do not push unless Parker asks.

End with "Manual for Parker": turretin:parse → review-summary → fix corrected:/book: in turretin.review.txt (known PDF damage: John 8:141 → 8:1-11—1:115; Rom 7:1749 → 7:17-19—2:698) → turretin:gate until pass; then start Opus chat for import per docs/session-prompts/turretin-text-layer-workflow.md.
```

---

## Step 2 — Parker (manual)

1. `npm run turretin:parse` (or path in script default)
2. `npm run turretin:review-summary` — work by page / reason
3. Fix blocks in `turretin.review.txt` (`corrected:` lines; known gold: `8:1-11—1:115` for PDF `8:141`; Romans `7:17-19—2:698` for `7:1749`)
4. Re-run until **`npm run turretin:gate` passes**

---

## Step 3 — Opus 5.5: import (only if gate passes)

```
Session: library — Turretin index import (text layer)
Read: AGENTS.md, docs/decisions/270-turretin-text-layer-parser.md, docs/decisions/274-turretin-review-gate-and-routing.md, src/lib/library/systematics-set-routing.ts, docs/session-prompts/turretin-text-layer-workflow.md, existing scripture_references / index insert patterns in repo

Prerequisite: npm run turretin:gate exits 0 on Parker's machine (review empty, gold leaves OK).

Supabase: hosted only. Service role via .env.local in CLI script only. Dry-run default; --apply writes.

Goal: import-turretin-index.ts — read turretin.rows.json; routeIndexRowToVolume + stripVolumeFromPageToken; insert scripture_references on correct Turretin volume books only; idempotent dedupe; owner-only.

Do not run --apply in agent session unless Parker explicitly asks. Security-review subagent on diff before push. npm run check + test. Decision log + PLAN. Manual for Parker: exact --apply command + smoke URLs.

End-of-session gate per AGENTS.md / workflow.mdc.
```

---

## Step 4 — Fable 5.1: pre-apply audit (read-only)

```
Session: library — Turretin import audit (read-only)
Read: docs/session-prompts/turretin-text-layer-workflow.md, docs/decisions/270-turretin-text-layer-parser.md, import script + diff vs main, turretin-gate.ts

Goal: Read-only audit before Parker runs import --apply. No file edits unless Parker asks.

Checklist:
- Gate policy matches 270 (no silent PDF fixes; apocrypha; short_page on accept)
- Import: dry-run default, dedupe, volume routing, no client service role, RLS unchanged or correctly extended
- Idempotency / re-run story documented
- Manual for Parker complete (apply, smoke, audit_log)
- Anything missing for safe prod apply?

Output: short pass/fail + bullet findings; optional Bugbot if not yet run and diff >400 LOC.
```

---

## After import

Smoke: `/library/search-passage?bible_book=1+Thessalonians&chapter=1&verse=5`. Then Calvin capture per checklist ([262](../decisions/262-calvin-index-capture-rules.md)).
