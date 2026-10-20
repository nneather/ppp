# 279 — Turretin scripture index import (text layer)

**Date:** 2026-10-20
**Module:** library (systematics index)
**Tracker session:** ad-hoc — [systematics-capture-checklist.md](../systematics-capture-checklist.md) Turretin square-up step 3 (import)

## Built

- `scripts/ocr-index-eval/import-turretin-index.ts` + `npm run turretin:import` — dry run by default; `--apply` inserts; `--revive-deleted` un-deletes soft-deleted matches. Runs `runGateChecks` on the local artifacts first and refuses on fail.
- `scripts/ocr-index-eval/turretin-import-plan.ts` — pure: `resolveTurretinVolumes`, `rowToScriptureInsert` (`routeIndexRowToVolume` + `stripVolumeFromPageToken`), `computeVerseAbs` (mirrors `compute_verse_abs()`), `naturalKey`, `planTurretinImport`, `formatImportPlan`.
- Tests: `scripts/ocr-index-eval/__tests__/turretin-import-plan.test.ts` (17).
- `scripts/ocr-index-eval/turretin-apocrypha-pending.json` — committed holding file for vocab-blocked rows (`pendingVocabFile`).
- `loadGateInputsFromDisk` exported from `turretin-gate.ts` (no logic change).

## Dry run against prod (2026-10-20, Parker's rows.json — 11,129 rows)

| Volume | Book id | Canon insert | Apocrypha insert |
|---|---|---|---|
| I | `93324149-56ef-4602-8a14-1a111d07ed20` | 3,281 | 0 |
| II | `4e87b189-019a-45ad-b469-4455c5aa753d` | 4,980 | 0 |
| III | `b73c5789-9463-41a1-9e74-3459161da25f` | 2,817 | 0 |
| **Total** | | **11,078** | **0** |

Skipped 51 — all apocrypha (`bible_book_not_in_vocab`). `scripture_references.bible_book` is an FK to `bible_books(name)`; prod has only the 66 canonical books. 2 Esdras 3, Tobit 7, Judith 4, Wisdom of Solomon 8, Sirach 10, Baruch 1, 1 Maccabees 9, 2 Maccabees 9. Each run writes them to **`scripts/ocr-index-eval/turretin-apocrypha-pending.json`** (committed) so they survive a lost or regenerated `rows.json`.

Two bad tokens from the first dry run were fixed in `turretin-manual-corrections.ts` (Parker, 2026-10-20), then re-parsed and re-gated (PASS, gold 1025/1025):

- `1 Corinthians 10:16,17-4:445` (p.769 col 1) — publisher typo → **`3:445`**.
- `Revelation 12:11-2:21142, 221` (p.780 col 1) — glued range → **`2:211-12, 221`** (stored abbreviated like other ranges: `page_start 211`, `page_end 12`).

Warn-only (inserted): 7 rows cite a page up to ~70 past the last outline page (vol III 661–676, vol I 697). Parker confirmed these are appendices the outline does not cover.

## Applied (2026-10-20, run started `2026-10-20T14:58:31.211Z`)

- Parker ran `npm run turretin:import -- --apply`: **Inserted 11,078**, revived 0.
- Verified on prod: vol I 3,281 / vol II 4,980 (+1 seed row) / vol III 2,817 live; **0 natural-key duplicates**; 11,078 `audit_log` INSERT rows; `created_by` = owner on every row.
- Smoke data: 1 Thess 1:5 → I:252, I:330 (range row), II:534, II:620 (252 seed), II:621. John 8:11 → II:112. Fixes landed: 1 Cor 10:16–17 → III:445; Rev 12:11 → II:211–12 and II:221.
- Rollback, if ever needed: soft-delete `scripture_references` on the three volume books with `created_at >= '2026-10-20T14:58:31Z'`.

## Decided

- **Volume resolution:** series name `Institutes of Elenctic Theology (Turretin)` → exactly one **live** book per `volume_number` I/II/III. Prod has a soft-deleted duplicate vol III (`4735b182…`), which is ignored; two live books for one volume aborts.
- **Routing is explicit-only.** A row imports only when `routeIndexRowToVolume` returns `explicit_volume`. Outline-page and default fallbacks would file a bad volume token on some book silently.
- **Index-row fields match Calvin practice:** `needs_review=false`, `confidence_score=1`, `review_note=null`, `source_image_url=null`, `created_by=POS_OWNER_ID`. Page tokens are stored as printed. Abbreviated page ends stay abbreviated (`536`–`64`), the same as gold and Chicago display.
- **Idempotency by natural key:** `book_id | bible_book | verse_start_abs | verse_end_abs | page_start | page_end`. The abs range is computed in TypeScript to match the trigger, so `8:11` and `8:11–8:11` are one row. Live match → skip. Soft-deleted match → skip by default, so a hand delete is not undone. Use `--revive-deleted` to bring those back. No unique index added (would need a migration; the CLI is the only bulk writer).
- **Apocrypha are blocked, not dropped.** The importer reads `bible_books` at run time and writes blocked rows to `turretin-apocrypha-pending.json`. Once a vocab migration lands, a re-run inserts only those 51 rows and the file empties.
- **Page sanity:** a page more than `PAGE_BEYOND_OUTLINE_SLACK` (100) past the volume's last outline page is skipped as glue. Smaller overruns insert with a warning. This guard lives in the importer; gate logic is unchanged.
- **Seed row kept.** The 252 hand-entered vol II row `1 Thess 1:5 → 620` does not match the printed index (`2:534, 621`), so the import does not dedupe it. Parker decides whether to delete it after apply.
- Rejected: requiring the gate's warn-free state, and auto-fixing `4:445` → `3:445` (no silent PDF fixes — [270](270-turretin-text-layer-parser.md)).

## Schema changes

- None.

## Security

- Security Review subagent: no medium/high/critical findings. Applied its defense-in-depth note: the revive update also filters `book_id` to the three volume ids.
- Service role only via `getPppMcpClient()` (owner assert). Nothing under `src/` imports the script.
- Audit: `trg_audit_scripture_references` writes one `audit_log` INSERT row per insert. `changed_by` is NULL under the service role; attribution lives in `scripture_references.created_by`.

## Open questions surfaced

- **Apocrypha vocab migration** — add 8 books to `bible_books` (testament value + sort order), plus `BIBLE_BOOK_NAMES`, by-book spine, studies, MCP, and Edge allowlist. Owner: Parker. Before re-running import for those 51 rows.
- **Gate gap** — the gate does not check volume ∈ {1,2,3} or page sanity. The importer guards both; add to the gate if parse is touched again.

## Surprises (read these before the next session)

- The `bible_books` FK made the apocrypha a hard block. 274's "insert waits on vocab" was literal.
- The user Supabase MCP was unauthorized; the plugin Supabase MCP (`ppp-prod`) worked for read-only checks.

## Carry-forward updates

- [x] components.mdc — n/a
- [x] AGENTS.md inventory — Scripts line (`turretin:import`)
- [x] new env vars — none (reuses `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POS_OWNER_ID`)
- [x] tracker / checklist — `systematics-capture-checklist.md` Turretin step updated
