# 021 — Library Session 9 OCR Anthropic wiring + review surfacing + trip policy

**Date:** 2026-05-16  
**Module:** library  
**Tracker session:** Session 9 (continuation)

## Built

- **`ocr_scripture_refs` Edge Function** — Replaced stub with Anthropic **Messages API** (vision): service-role download from `library-scripture-images`, base64 image block, `temperature: 0`, JSON-only system contract. Returns `{ rawText, candidates }`; candidates filtered to the 66-name Protestant allowlist (`bible-book-allowlist.ts`, aligned with `supabase/seed/library_seed.sql`). Rejects unsupported vision MIME types with **415** (HEIC — user should get JPEG/PNG from client downscale path when possible). **~4.5 MiB** raw image cap before encode. Errors return `{ error: string }` for `extractScriptureRefs` + `ocrInvokeDataError` surfacing. **Redeployed to prod** (`npm run supabase:deploy-functions`) **2026-05-16**.
- **Secrets** — `ANTHROPIC_API_KEY` required in Supabase Edge secrets; optional `ANTHROPIC_OCR_MODEL` (defaults to `claude-sonnet-4-6`). Documented in [supabase/README.md](../../supabase/README.md); [015](015-library-session-9-ocr-kickoff.md) carry-forward updated.
- **`/library/review`** — `loadScriptureRefsNeedingReview` in [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts); lists up to 50 `scripture_references` with `needs_review` + `book_id`, deep-linking to `/library/books/[id]#ref-<uuid>`.
- **`src/lib/library/scripture-ref-format.ts`** — `formatScriptureRefRangeDisplay` + `formatScriptureRefPageSummary` for list labels; type `ScriptureRefNeedingReviewListItem` in [`src/lib/types/library.ts`](../../src/lib/types/library.ts).
- **Tracker + PLAN** — Trip Period reframed: **build allowed during trip**; **shelf-bound** work (Pass 2 drill-down, BDAG / Calvin CC / Bruce / Hodge / NBD checks, full ~1,288 access) deferred to August. Session 8 + Session 9 headers updated accordingly.

## Decided

- **Anthropic vs Tesseract-first** — Stay on **015** default: single round-trip vision + structured JSON in the assistant text block (not tool-use) for MVP simplicity.
- **`bible_book` validation** — Drop candidates whose `bible_book` is not in the seeded 66-name set (prevents model hallucinations from entering the batch parser).
- **HEIC** — Vision API accepts jpeg/png/webp/gif only in this integration; return a clear **415** so the user converts or relies on client JPEG path where available.
- **Trip policy (tracker amendment)** — **Build CAN happen during the trip** (OCR, schema/UI/Edge, mobile polish, Session 8 pure-function prep). **Constraint:** ~200 scholarly-core books travel; anything needing an arbitrary physical volume from the full library waits until **August**. Documented in [POS_Library_Build_Tracker.md](../../docs/POS_Library_Build_Tracker.md) + [PLAN.md](../../PLAN.md).

## Schema changes

- None.

## New components / patterns added

- **Edge env:** `ANTHROPIC_API_KEY`, optional `ANTHROPIC_OCR_MODEL`; existing auto-injected `SUPABASE_*` keys for auth + storage.
- **Review page pattern:** scripture refs needing review as a **secondary list** under the books card stack (not a second card stack; `/library` filter chips for “scripture refs only” remain a future nicety).

## Open questions surfaced

- Optional `/library?…` filter to show only books that have `scripture_references.needs_review` — not built this slice.

## Surprises

- (Fill on first prod smoke.) If Anthropic returns non-JSON prose, the function returns 502 “Could not parse structured citations…”.

## Carry-forward updates

- [x] `components.mdc` — no new PascalCase components.
- [x] [supabase/README.md](../../supabase/README.md) — OCR secrets + function row.
- [x] [AGENTS.md](../../AGENTS.md) — `ocr_scripture_refs`, `scripture-ref-format.ts`, `loadScriptureRefsNeedingReview`, `.env.local` `ANTHROPIC_API_KEY` note.
- [x] [015](015-library-session-9-ocr-kickoff.md) — carry-forward checkboxes for Anthropic integration.
- [x] **Owner / agent:** `npm run supabase:deploy-functions` — run **2026-05-16** (all three functions).
- [ ] **Owner:** `supabase secrets set ANTHROPIC_API_KEY=…` on hosted project if not already set (function returns 503 until present); optional `ANTHROPIC_OCR_MODEL`; then **5-image smoke** (upload → Extract → Save batch → confirm rows + `/library/review` links).
- [ ] **Owner:** Viewer smoke for Session 9 acceptance (solo use deferred).
