# 030 — OCR PDF input (multi-page, one call)

**Date:** 2026-05-18  
**Module:** library (Session 9 OCR)  
**Tracker session:** ad-hoc (Genius Scan PDF workflow)

## Built

- **Storage** — [`20260518180000_library_scripture_images_pdf_mime.sql`](../../supabase/migrations/20260518180000_library_scripture_images_pdf_mime.sql): `application/pdf` on `library-scripture-images`; `file_size_limit` 25 MiB.
- **Edge** — [`ocr_scripture_refs`](../../supabase/functions/ocr_scripture_refs/index.ts): `anthropicVisionInput` routes images vs PDF; Anthropic `document` content block for PDFs; `MAX_PAYLOAD_BYTES` 25 MiB; prompt + `source_page_index` on candidates; generalized truncation 422 message.
- **Client** — [`scripture-reference-form.svelte`](../../src/lib/components/scripture-reference-form.svelte): batch `accept="image/*,application/pdf"`; PDF upload without canvas downscale; queue PDF chip (`FileText`); merge groups by `source_page_index` with **Page N/M** separators; shared type in [`ocr-scripture-refs.ts`](../../src/lib/library/ocr-scripture-refs.ts).
- **Follow-up (same day)** — [`ocr-invoke-client.ts`](../../src/lib/library/ocr-invoke-client.ts): batch OCR calls Edge **from the browser** (`functions.invoke`) instead of `?/extractScriptureRefs` server action, avoiding Vercel serverless timeout (`Load failed` on multi-page PDFs). Server action kept as thin proxy with `maxDuration: 300`.
- **Per-page PDF split (same day)** — Edge `pdf-lib`: `op: pdf_page_count` + `pdf_page_index` per extract; client loops **Page 1/N** sequentially. Error mailto defaults to `parker.neathery@gmail.com`.
- **Client rasterize (same day)** — [`pdf-page-render.ts`](../../src/lib/library/pdf-page-render.ts) (`pdfjs-dist`, dynamic import): each PDF page → JPEG (~2048px) → `image/jpeg` OCR (same path as photos); original PDF stays `source_image_url`. Partial batch: continue on page failure, merge candidates + warning + **Retry failed pages**. Edge `max_tokens` 32k for image inputs only; 64k for `document` PDF fallback.
- **Deployed** migration + `ocr_scripture_refs` **2026-05-18**.

## Decided

- **One Anthropic call per multi-page PDF (option B)** over server-side per-page split (option C): cross-page `continuation_from_previous_page` and semicolon splits see adjacent pages; fewer system-prompt round trips; no Deno PDF splitter.
- **No client-side PDF compression** (initial ship) — Genius Scan “Lighter” preset is the manual lever above 25 MiB. **Later:** `pdfjs-dist` added only on the PDF OCR path (dynamic import) for rasterize, not for upload size reduction.

## Schema changes

- `storage.buckets` row update only (`allowed_mime_types`, `file_size_limit`). No `public` schema change.

## New components / patterns added

- First `document` (PDF) content block in `ocr_scripture_refs` (still used for debug / non-raster callers); optional `source_page_index` on OCR candidates (not persisted on `scripture_references` — UI grouping only).
- [`pdf-page-render.ts`](../../src/lib/library/pdf-page-render.ts) — `getPdfPageCountFromFile`, `renderPdfPageToJpegBlob`; worker via Vite `?url` on `pdf.worker.min.mjs`.

## Verification

- [x] `npm run supabase:db:push` — migration applied.
- [x] `npm run check` — clean (2026-05-18).
- [x] `npm run supabase:deploy-functions` — `ocr_scripture_refs` deployed.
- [ ] **Owner:** Single-page Genius Scan PDF → draft rows like JPEG.
- [ ] **Owner:** 5-page PDF (~2.6 MB) → strip separators **Page 1/5 … 5/5**; same `source_image_url` on all rows from that file.
- [ ] **Owner:** Mixed batch (2 JPEGs + 1 PDF) ordering; JPEG regression on `c500a7ba-…`.

## Open questions surfaced

- Per-page `source_image_url#page=N` anchor — deferred if reviewers need deep links beyond strip labels.

## Surprises

- **Multi-page PDF via server action → `Load failed`** — upload succeeded but `fetch('?/extractScriptureRefs')` aborted when Vercel’s serverless limit cut the proxy hop before Anthropic finished (~60s+). Fixed by browser-direct `functions.invoke`.
- **Full PDF single Edge call → `Failed to send a request to the Edge Function` + log `shutdown`** — Supabase ~150s idle limit. Fixed by **one Anthropic call per PDF page** (`pdf_page_index` + `pdf-lib` page extract on Edge).
- **Dense index pages still timed out on page 2/5** — per-page Edge `document` blocks could exceed ~150s. Fixed by **browser rasterize → `image/jpeg` OCR**; archival rows still point at the uploaded `.pdf`. Ops lever: `ANTHROPIC_OCR_MODEL=claude-haiku-4-5` in Supabase secrets for faster (less accurate) OCR.

## Carry-forward updates

- [x] [AGENTS.md](../../AGENTS.md)
- [x] [PLAN.md](../../PLAN.md)
