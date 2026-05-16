# 015 — Library Session 9 OCR kickoff (provider + Edge contract + stub)

**Date:** 2026-05-04  
**Module:** library  
**Tracker session:** Session 9 (spike / first slice)

## Built

- **Open Question 7 resolved:** MVP OCR stack targets **Anthropic Claude** (Messages API with vision / structured JSON output, or hybrid OCR text → structured parse) as the default implementation path — aligns with existing API usage patterns noted in `docs/decisions/005-scripture-refs-bulk-and-ocr-design.md`. **Alternatives** (Google Document AI / Vision, AWS Textract, self-hosted Tesseract + LLM parse) remain valid if evaluation below favors them after real corpus testing.
- **Edge Function stub** `ocr_scripture_refs` — authenticates via `Authorization` + `/auth/v1/user`; validates `object_path` matches `${jwt.sub}/${book_id}/…`; returns `{ rawText: '', candidates: [] }` until provider integration lands. **No** inserts/updates to `scripture_references`.
- **Server action** `extractScriptureRefs` on `/library/books/[id]` — invokes the Edge Function with the user session JWT; returns candidates to the client for draft rows only.
- **`<ScriptureReferenceForm>`** batch mode — “Extract from image” after upload; populates draft rows from candidates; **0.80 confidence threshold** pre-sets `needs_review` per `005`.
- **Batch save** — `rows_json` extended with optional `confidence_score` so OCR rows persist metadata through `createScriptureRefsBatch`.

## Decided

- **Provider criteria (revisit when wiring the real call):** verse-range accuracy on printed biblical citations; mixed Hebrew/Greek/Latin snippets; cost and rate limits for batch photo sessions; EU/data residency if relevant; operational simplicity (Anthropic vs managing Tesseract).
- **Read-only viewers + storage (013):** scripture image SELECT still assumes library module **write** access for signed URLs in loaders; OCR extract uses the same upload path as manual entry. If read-only viewers must run OCR without writer storage rights, follow up with a storage policy adjustment — out of scope for this spike.

## Schema changes

- None this slice.

## New components / patterns added

- **Edge I/O contract (stable JSON):**
  - **Request:** `{ object_path: string; mime_type: string; book_id: string }` — `object_path` is the `library-scripture-images` object key (`${userId}/${bookId}/…`).
  - **Response:** `{ rawText: string; candidates: OcrCandidate[] }` where each candidate matches scripture form fields:
    - `bible_book: string`
    - `chapter_start`, `verse_start`, `chapter_end`, `verse_end` — numbers or omitted
    - `page_start`, `page_end` — strings or omitted
    - `confidence_score: number` — 0–1
- **Secrets (when provider is wired):** `ANTHROPIC_API_KEY` — set with `supabase secrets set ANTHROPIC_API_KEY=…`; mirror in `.env.local` for local Edge runs per `AGENTS.md`. Stub does not require it.

## Open questions surfaced

- PDF / non-image files — separate bucket + MIME allowlist (deferred; batch UI is image-first).

## Surprises

- None yet.

## Carry-forward updates

- [x] `components.mdc` — no new component names.
- [x] Full Anthropic (or alternative) integration + smoke on 5 images — Session 9 continuation (see [`021-library-session-9-ocr-anthropic-wired.md`](021-library-session-9-ocr-anthropic-wired.md); `ANTHROPIC_API_KEY` + optional `ANTHROPIC_OCR_MODEL` in Supabase Edge secrets per [`supabase/README.md`](../../supabase/README.md)).
