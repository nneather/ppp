# 017 — Library CSV export / import

**Date:** 2026-05-07  
**Module:** library  
**Tracker session:** (ad hoc)

## Built

- Owner-only CSV export of all live books (`GET` [`/settings/library/export/download`](src/routes/settings/library/export/download/+server.ts)) with stable headers including `authors` (display) and `authors_json` (full junction round-trip).
- Settings page [`/settings/library/export`](src/routes/settings/library/export/+page.svelte): preview import (`?/previewLibraryCsv`) and apply (`?/applyLibraryCsv`) with confirm dialog; re-parses CSV on apply (no trusted client payload).
- Shared [`applyBookPayload`](src/lib/library/server/book-actions.ts) for create/update + optional `skipAuthorSync` when reimporting updates without an `authors_json` cell.
- Pure CSV helpers in [`books-csv.ts`](src/lib/library/server/books-csv.ts): RFC 4180-style parse, UTF-8 BOM strip, row cap 1000, category name + series label resolution, merged `book_categories` on update (secondary categories not exported in v1).

## Decided

- **Reimport without `authors_json` on update:** skip `syncAuthors` so spreadsheet edits to the human `authors` column do not wipe junctions.
- **Insert:** blank `id`; same validation as book form via `parseBookForm` on a synthetic `FormData`.
- **Export GET:** dedicated route handler so the browser downloads with `Content-Disposition: attachment` without relying on form `Response` behavior.

## Schema changes

- None.

## New components / patterns added

- [`src/lib/library/server/books-csv.ts`](src/lib/library/server/books-csv.ts) — CSV contract + `prepareLibraryCsvImport` / `applyPreparedLibraryCsv`.

## Open questions surfaced

- Partial apply on mid-batch failure: today the loop stops at first DB error; a transactional all-or-nothing mode would need a different strategy (owner: Parker — only if bulk imports become frequent).

## Surprises (read these before the next session)

- `requestSubmit` must target a hidden submit button carrying `name="confirmed"` + `value="true"` and `formaction="?/applyLibraryCsv"` so preview and apply stay in one multipart form.

## Carry-forward updates

- [ ] components.mdc updated (no new shared UI component)
- [ ] AGENTS.md inventory updated (optional)
- [ ] new env vars documented (none)
