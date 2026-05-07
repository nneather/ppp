# 019 — Library TSV export/import + streaming apply progress

**Date:** 2026-05-07  
**Module:** library

## Built

- **TSV export** — [`buildLibraryBooksTsv`](src/lib/library/server/books-csv.ts) + download route serves `text/tab-separated-values`, filename `library-books-YYYY-MM-DD.tsv`. [`buildLibraryBooksCsv`](src/lib/library/server/books-csv.ts) remains as a deprecated alias.
- **Delimited parse/build** — [`parseDelimitedRows`](src/lib/library/server/books-csv.ts) / [`buildDelimitedFromRows`](src/lib/library/server/books-csv.ts) with tab or comma; RFC 4180-style quoting when needed.
- **Import prep** — [`prepareLibraryBooksImport`](src/lib/library/server/books-csv.ts) with [`sniffLibraryImportFormat`](src/lib/library/server/books-csv.ts): `.csv` / `.tsv` extension wins; otherwise first header line uses more commas than tabs → CSV, else TSV.
- **Apply progress** — [`POST /settings/library/export/apply-stream`](src/routes/settings/library/export/apply-stream/+server.ts) streams **NDJSON** (`application/x-ndjson`): `prepare`, `progress` (per completed op), `complete` or `error`. Client uses `fetch` + `ReadableStream` (not a form action).
- **UI** — [`/settings/library/export`](src/routes/settings/library/export/+page.svelte): TSV-first copy, file accept `.tsv`/`.csv`, native `<progress>` during apply, ConfirmDialog still gates apply.

## Decided

- **Re-parse on apply** — Preview and apply-stream each call `prepareLibraryBooksImport` (no server-stored prepared payload).
- **NDJSON over mixed HTTP codes for stream** — Prepare failures are a line with `type: 'error', phase: 'prepare'` so the client uses one reader path; HTTP 4xx/403 only for auth / bad request before the stream starts.

## NDJSON contract

| `type` | Fields | When |
|--------|--------|------|
| `prepare` | `ok: true`, `format: 'tsv' \| 'csv'` | After successful prepare |
| `progress` | `phase: 'apply'`, `done`, `total`, `op: 'insert' \| 'update' \| 'softDelete'` | After each successful op |
| `complete` | `inserted`, `updated`, `deleted` | All ops succeeded |
| `error` | `phase: 'prepare'`, `errors: { line, message }[]` **or** `phase: 'apply'`, `line`, `message` | Validation or first apply failure |

## Schema changes

- None.

## Carry-forward

- Very large imports may still hit serverless max duration; streaming does not extend the limit (future: chunking / resume).
