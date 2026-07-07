# 062 — Library Wave 2 Session 3 — megacomponent split

**Date:** 2026-07-06
**Module:** library
**Tracker session:** Wave 2 Session 3

## Built

- **`scripture-reference-form.svelte` shell** (~900 LOC, was ~2,465) — orchestrates batch/edit modes; props/callbacks unchanged for `/library/books/[id]`.
- **`<ScriptureOcrQueue>`** — multi-file/PDF OCR queue, pipeline, page status chips, retry; `bind:pages` / `bind:rows` / `bind:ocrPipelineBusy`; `onDraftClear` on OCR start **and** clear-queue.
- **`<ScriptureRowEditor>`** — single draft row (edit card + compact strips + expanded mobile/desktop grid); `bind:row` + callback props.
- **`scripture-draft-row.ts`** + **`scripture-ocr-merge.ts`** — shared row types, strip labels, OCR merge into draft rows.
- **`book-form.svelte` shell** (~1,128 LOC, was ~1,929) — identity/classification/state/series/save bar; `pub` object for publication fields.
- **`<BookFormAuthors>`** — author junction rows, B14 dedup hints, inline person-create dialog.
- **`<BookFormPublication>`** — `variant="essentials"` (publisher/year) + `variant="extended"` (edition/reprint/ISBN); `bind:pub`.
- **`book-form-ol.ts`** — `applyOlPrefillFields`, `applyOlRefreshPatch`, `buildOlAuthorRows`; unit tests in `book-form-ol.test.ts`.

## Decided

- **Shell owns dirty/snapshot + seed `$effect`s** — OL prefill logic extracted to pure helpers but `untrack`-wrapped effects stay in `book-form.svelte` (Session 1.5c footgun class).
- **`{#key seedKey}` on `<ScriptureOcrQueue>`** — remount clears internal OCR queue on edit/create mode swap without imperative API.
- **Decision file 062** — 061 already taken by PWA shell session; next free number per workflow rule.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/components/scripture-ocr-queue.svelte`](../src/lib/components/scripture-ocr-queue.svelte)
- [`src/lib/components/scripture-row-editor.svelte`](../src/lib/components/scripture-row-editor.svelte)
- [`src/lib/components/book-form-authors.svelte`](../src/lib/components/book-form-authors.svelte)
- [`src/lib/components/book-form-publication.svelte`](../src/lib/components/book-form-publication.svelte)
- [`src/lib/library/scripture-draft-row.ts`](../src/lib/library/scripture-draft-row.ts)
- [`src/lib/library/scripture-ocr-merge.ts`](../src/lib/library/scripture-ocr-merge.ts)
- [`src/lib/library/book-form-ol.ts`](../src/lib/library/book-form-ol.ts)
- [`src/lib/library/__tests__/book-form-ol.test.ts`](../src/lib/library/__tests__/book-form-ol.test.ts)

## Open questions surfaced

- None blocking Session 4 (`.docx` export).

## Surprises (read these before the next session)

- **Bugbot:** `clearBatchPages` initially omitted `onDraftClear` — fixed same session so sessionStorage draft clears with queue reset.
- **Owner phone smoke** — re-run `.claude/skills/library-owner-smoke/` after megacomponent split (scripture batch OCR + book form create/edit).

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [ ] new env vars documented — N/A
- [x] tracker Wave 2 Session 3 marked done
- [x] PLAN.md refreshed
