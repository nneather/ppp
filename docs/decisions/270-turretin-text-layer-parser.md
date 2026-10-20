# 270 — Turretin scripture index from PDF text layer

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (systematics index capture)

## Built

- `scripts/ocr-index-eval/parse-turretin-text.ts` — pdf.js text positions, three columns (anchors x ≈ 130 / 250 / 360), per-page column order top-to-bottom then page → col1 → col2 → col3. Uses `parseIndexEntry` + `validateIndexRows` (per-line accept gate). Re-run contract: corrected lines under `# p.NNN col N` in `turretin.review.txt` merge into `turretin.lines.txt`.
- Gitignored outputs next to the script: `turretin.lines.txt`, `turretin.review.txt`, `turretin.rows.json`.
- Gold-leaf spot check on printed pp. **760 / 764 / 766** vs `gold/page-03.json`, `page-01.json`, `page-02.json`: **1023/1025 exact (99.805%)** — printed p. **764** is **100%**. Remaining misses: John `8:1–11` (PDF `8:141`) and Romans `7:17–19` (PDF `7:1749`); both in review (`suspicious_verse_token` / `validateIndexRows`). Flush pending entry before `# book` heading (Luke `24:52` → John).
- `validateIndexRows` on accept skips `short_page_among_longer` (valid `1:10` beside `1:242` on one index line).
- Apocrypha on printed **754** col 1 → `apocrypha (skipped)` in review (no `scripture_references` rows).

## Decided

- Text-layer path is the bulk capture source for Turretin ([267](267-systematics-index-sources.md)); no `ocr_scripture_refs`, no rasterize, no cap burn.
- Column lines must be sorted by `(printedPage, −y)` within each column; naive page-wide y-buckets interleave columns on a shared baseline.
- Do not insert index rows until **`npm run turretin:gate`** passes ([274](274-turretin-review-gate-and-routing.md)); insert must use `routeIndexRowToVolume` + `stripVolumeFromPageToken` per volume (deferred). Cursor agent order: Composer → Parker review → Opus import → Fable audit — [session-prompts](../session-prompts/turretin-text-layer-workflow.md).

## Schema changes

- None.

## New components / patterns added

- `parse-turretin-text.ts` (script only). README + `.gitignore` entries.

## Open questions surfaced

- Clear the three gold misses + remaining review queue; then wire insert + outline topic lookup.

## Surprises (read these before the next session)

- FineReader glued `8:141` for gold `8:1–11`; `suspicious_verse_token` (verse > 100, non-Psalms) catches it after parse.
- `754 INDEX` header line still hits review as noise on col 1.

## Carry-forward updates

- [ ] components.mdc updated — n/a
- [ ] AGENTS.md inventory updated — optional script line in ocr-index-eval README only
- [ ] new env vars — none
- [ ] tracker Open Questions updated — Turretin bulk capture waits on review clear
