# 034 — Scripture batch upload performance

**Date:** 2026-05-19
**Module:** library
**Tracker:** Scripture batch upload perf plan

## Built

- After OCR merge, rows **collapse by default**; only `continuation_from_previous_page` + empty `bible_book` stay expanded ([`collapseRowsAfterMerge`](src/lib/library/scripture-batch-upload.ts)).
- **Windowed** row list (50+ rows) with scroll spacers; **submit-time** `rows_json` via chunked `fetch` (75 rows/chunk).
- **`patchRow`** for single-row updates at scale; OCR file pipelines capped at **concurrency 2**; `extractLabel` throttled in a side map.
- **`sessionStorage` draft** per book (24h) with resume/discard banner; `beforeunload` + book-detail `beforeNavigate` when batch form dirty.
- Sticky footer: OCR/save progress; optional **Wake Lock** during pipeline; Save disabled while OCR busy.
- Unit tests: `scripture-batch-upload.test.ts`.

## Decided

- Simple fixed-height windowing (no `@tanstack/svelte-virtual`) — sufficient with collapse-by-default.
- Chunked save stays on existing `createScriptureRefsBatchAction` (one POST per chunk) rather than a new server API.
- Session draft omits `File` blobs and preview URLs; storage paths on rows are enough to resume review without re-OCR.

## Schema changes

- None.

## New components / patterns added

- `src/lib/library/scripture-batch-upload.ts` — payload, windowing, collapse, chunking, progress label.
- `src/lib/library/scripture-batch-draft.ts` — session draft read/write.
- `src/lib/library/run-with-concurrency.ts` — generic pool helper.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- In-place `rows[idx]` updates need `rows = rows` to notify Svelte 5 when using `patchRow` at scale.

## Owner QA checklist

- [ ] 5-page PDF on phone: OCR completes, footer shows progress, UI scrollable
- [ ] 100+ row index: merge interactive as strips; expand one row — no full-page freeze
- [ ] Refresh mid-review → resume draft banner works
- [ ] Save 150 rows: chunked progress; book detail reloads refs after

## Carry-forward updates

- [x] performance.mdc updated
- [ ] AGENTS.md inventory updated (optional — helpers listed in decision)
- [ ] tracker Open Questions updated
