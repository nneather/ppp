# 026 — OCR density / truncation fix

**Date:** 2026-05-18  
**Module:** library (Session 9 OCR)  
**Tracker session:** ad-hoc (prod OCR failure on scripture index page)

## Built

- **[supabase/functions/ocr_scripture_refs/index.ts](../../supabase/functions/ocr_scripture_refs/index.ts)** — `max_tokens` raised from **4096 → 64000** (Claude Sonnet 4.6 output cap). System prompt: **`rawText`** is now a one-sentence page descriptor (≤200 chars); model must **not** echo individual citations in `rawText` (those belong in `candidates` only). **`stop_reason === 'max_tokens'`** → HTTP **422** with actionable “split into two photos” message (~1,800-citation ceiling). **Prose-only model output** (no `{` / `[`) → HTTP **200** with `{ rawText, candidates: [] }` instead of a misleading 502 JSON-parse error.
- **Deployed** via `npm run supabase:deploy-functions` to hosted project **2026-05-18**.

## Decided

- **Root cause (confirmed from Edge logs):** model filled `rawText` with a long citation echo; output hit the old 4k cap mid-JSON string → `Unterminated string in JSON at position 9642` → generic 502.
- **Keep `rawText` in the response shape** — [src/routes/library/books/[id]/+page.server.ts](../../src/routes/library/books/[id]/+page.server.ts) requires `typeof payload.rawText === 'string'`. Prompt constrains content; field stays for debug / contract.
- **Raise to model max (64k), not a smaller “safe” number** — unused headroom does not add cost; model stops at `end_turn`. ~35 tokens per candidate → ~1,800 refs/request; Turretin-class index folios (~200–500 refs) sit at **3–9× margin**.
- **`$app/stores` `updated` N/A** — Edge-only change.

## Schema changes

- None.

## New components / patterns added

- Edge-fn **`stop_reason` short-circuit** before `parseModelJson` — reuse if a second vision function ships.

## Verification

- [x] `npm run check` — clean (2026-05-18).
- [x] `npm run supabase:deploy-functions` — `ocr_scripture_refs` deployed.
- [ ] **Owner:** Re-OCR the failing page (book `c500a7ba-9cac-4bb3-be04-11149ff19df6`, job `b318bf4e-…` image). Expect **200** with full `candidates` list and short `rawText`.
- [ ] **Owner:** Spot-check a normal commentary page (quality unchanged).
- [ ] **Owner:** Edge logs on success should show `stop_reason: end_turn` (not `max_tokens`).

## Open questions surfaced

- If someone photographs an **entire multi-page index as one image** and still hits 422, next escape hatch is two-pass OCR (split image client-side, merge candidate lists). Not built today.

## Surprises

- The incident page was **not** an extreme Turretin-density index — the **`rawText` echo alone** consumed most of the old token budget. Prompt fix + cap raise are independent safety layers.

## Carry-forward updates

- [x] [AGENTS.md](../../AGENTS.md) — `ocr_scripture_refs` bullet note on dense pages / 422
- [x] [PLAN.md](../../PLAN.md) — Recent decisions + last updated
