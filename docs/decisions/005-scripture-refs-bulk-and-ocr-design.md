# 005 — Scripture refs bulk entry + OCR design (Session 2 follow-up)

**Date:** 2026-04-29
**Module:** library
**Tracker session:** Session 2 (follow-up)

## Built

- **Trigger fix** at [`supabase/migrations/20260429180000_compute_verse_abs_chapter_only_fix.sql`](../../supabase/migrations/20260429180000_compute_verse_abs_chapter_only_fix.sql) — `compute_verse_abs()` now treats `chapter_start` with no `chapter_end` and no verses as **that chapter only** (`cs*1000 .. cs*1000+999`), not open-ended-to-end-of-book. Migration includes a no-op `UPDATE … SET chapter_start = chapter_start WHERE deleted_at IS NULL` to fire the BEFORE UPDATE trigger and recompute every live row's `verse_*_abs` in place.
- **Diagnostic** at [`supabase/diagnostics/library_compute_verse_abs_update_path.sql`](../../supabase/diagnostics/library_compute_verse_abs_update_path.sql) — header rewritten to spell out the full semantic table; new Step 5 asserts chapter-range (`cs=2, ce=3, no verses` → `2000..3999`); old Step 5 (whole-book collapse) renumbered to Step 6 and now also clears `chapter_end` to land cleanly on the whole-book sentinel branch.
- **Batch entry UX** at [`src/lib/components/scripture-reference-form.svelte`](../../src/lib/components/scripture-reference-form.svelte) — single component handles both modes:
  - **Edit mode** (`existingRef` set): one row, no Add/Duplicate/Remove controls, posts to `?/updateScriptureRef`.
  - **Batch create mode** (default): N draft rows starting with one, with Duplicate / Remove per row + "Add another reference" at the bottom. Posts to `?/createScriptureRefsBatch` with a `rows_json` payload. Empty rows are silently skipped server-side. Optional source image is **shared across the batch** (one page, many refs).
  - Submit button copy reflects the count: "Save 3 references", "Save 1 reference", "Save references" when nothing valid yet.
- **Server action** at [`src/lib/library/server/scripture-actions.ts`](../../src/lib/library/server/scripture-actions.ts) — added `parseScriptureRefBatchForm(fd)` + `createScriptureRefsBatchAction(supabase, userId, fd)`. Each row is validated through the existing single-row parser (so behavior stays in lockstep). Whole batch inserted in one `.insert(rows)` call so the audit log gets one INSERT row per reference but only one round-trip. Returns `{ kind: 'createScriptureRefsBatch', refIds, count, success: true }`.
- **Route wrapper** at [`src/routes/library/books/[id]/+page.server.ts`](../../src/routes/library/books/%5Bid%5D/+page.server.ts) — new `createScriptureRefsBatch` action; existing `createScriptureRef` (single) kept for backward compatibility / other callers.
- **Detail page** at [`src/routes/library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte) — Add button copy is now "Add references"; `onSavedBatch(refIds)` callback replaces single-row `onCreated`; `formMessage` derivation extended to surface `createScriptureRefsBatch` errors. Inline edit still calls the same form in edit mode.

## Decided (non-obvious)

- **Chapter-only means "that chapter only"** (not "from that chapter to end of book"). If you want chapter-to-end-of-book, set `chapter_end` to the actual last chapter. Open-ended-from-chapter is intentionally unsupported until we add a `scope_kind` column — and even then, only if it survives a real workflow review. The trigger fix + diagnostic codify this.
- **One component for edit + batch.** The plan called this out explicitly: "Keep single-row add as a degenerate case of the batch form, not a separate component." Edit mode = `rows.length === 1`, no controls visible, hidden inputs emit the legacy single-row contract that `?/updateScriptureRef` already speaks. Batch mode emits a single `rows_json` field. The server endpoints remain distinct because the single-row update path has S12 parent-immutability checks that don't apply to bulk insert.
- **Empty rows are skipped, not errors.** Users typically duplicate-row, then trim the trailing empty draft. Server treats `bible_book === '' && page_start === ''` as "skip" rather than failing the batch. A row with one of the two filled is still validated and will surface a row-indexed error.
- **Image is shared, not per-row.** Real workflow: a phone photo of one printed page hosts many references. The bucket convention already uses `${userId}/${bookId}/${ulid}.${ext}`, with no per-ref part — so the same path attaches cleanly to every row in the batch. Future enhancement: per-row image override; not on roadmap.
- **Save bar requires at least one valid row.** `hasAnyValidRow` (in component) and `parseScriptureRefBatchForm` (server) both check for `bible_book.length > 0 && page_start.length > 0`. Zero matches the "skip empty" rule (no point saving empties), one or more enables the button.
- **Batch insert is one `.insert(rows)` call.** Alternative: one INSERT per row inside a transaction. Single insert is cheaper and the existing audit trigger fires per row anyway, so the audit log stays correct. The cost is partial-failure granularity: a single row's CHECK violation aborts the whole batch. Acceptable trade because the parser pre-validates everything; a CHECK violation at insert time means a real schema-level problem, not a single bad row.

## OCR / file extraction — design (implementation deferred)

The user explicitly wants OCR-driven entry to be the default for hundreds-to-thousands of refs. Schema hooks (`source_image_url`, `confidence_score`, `needs_review`, `review_note`) and the storage bucket are already in place. The batch UI shipped in this round is the **review queue surface** OCR will feed into.

### Intended flow

```
User clicks "Extract references from image/file" inside the batch form
   ↓
Picks image (jpg/png/heic/webp) OR file (pdf, future: docx)
   ↓
File goes to storage (image bucket OR a new pdf bucket — separate decision)
   ↓
Edge Function or client call to OCR/parser provider
   ↓
Provider returns: { rawText, confidence, candidateRefs: [{ bible_book, chapter_start, … }] }
   ↓
candidateRefs populate the batch form's draft rows (replacing or appending)
   ↓
Each row pre-flags `needs_review = true` AND stores `confidence_score`
   ↓
User reviews, edits, or deletes rows; saves; batch action persists.
```

### Rules / constraints

- **OCR never writes final rows directly.** It only populates editable draft rows. The save button is always user-confirmed. This protects the audit log from low-confidence noise and gives users a clear "review queue" mental model.
- **Confidence threshold defaults to 0.80.** Below 0.80 → `needs_review = true` even if the user doesn't tick the checkbox. Adjustable in settings (Tracker_1 S10).
- **Parsing is structured, not freeform.** The provider must return a typed array of candidate refs, not a blob of text the client parses. Parsing-from-text is a separate, error-prone problem; we delegate to whatever provider/model already does it well.
- **Provider choice deferred.** Tracker_1 Open Question 7. Realistic options: Anthropic (function calling, already have key), GCP Vision + LLM parser, Tesseract local + LLM parser. Decision happens at the start of the OCR build session.
- **Batch UI is the review queue.** No separate route. The same form that takes manual entries takes OCR-extracted candidates; users don't switch contexts.
- **Failure modes:**
  - Upload OK, OCR fails → user falls back to manual entry; the image is still attached to the batch.
  - OCR returns 0 candidates → form shows "No references detected — add manually below"; rows stay empty.
  - OCR returns N candidates with low confidence → all are pre-checked `needs_review`; user is expected to verify before save.

### Implementation surface (post-trip)

- New button inside `<ScriptureReferenceForm>` (batch mode only): "Extract from image" (visible after image upload) and/or "Extract from file" (separate file picker, accepts PDF).
- New Edge Function (per `.cursor/rules/edge-functions.mdc`): `ocr_scripture_refs` — input `{ object_path | inline_data, mime_type }`, output `{ rawText, candidates: [{ bible_book, chapter_start, …, confidence_score }] }`.
- New action: `extractScriptureRefsAction` — wraps the Edge call, returns the candidate array as `form.candidateRows` for the page to feed back into the form.
- Form receives candidate rows via a new `seedRows?: DraftRow[]` prop OR via `invalidate()`-with-form-data; either way, the existing draft-row state replaces or appends.
- No schema change required — `confidence_score`, `needs_review`, `review_note` already exist.

### Why ship batch first, OCR second

- The batch UI is **independently useful** even without OCR. Manual bulk entry covers the trip-period workflow today; OCR is a velocity multiplier later.
- OCR feeds into the same UI surface, so we won't throw any of this away.
- OCR provider choice + tuning is high-variance; isolating it from the form refactor keeps risk localized.
- The user's primary failure mode without OCR is "I have to type 200 refs over a trip." That's mitigated to "I bulk-add a page at a time" today; OCR shrinks each page-batch from a minute of typing to a few seconds.

### Sequencing decision (2026-04-29)

After shipping the batch UI, evaluated whether to bring OCR forward into the pre-trip arc. Decided to **defer OCR to post-trip Session 9, but promote that session from "OPTIONAL" to "REQUIRED"** in `docs/POS_Library_Build_Tracker.md`. Reasons:

- **OCR unblocks nothing else.** Walked Sessions 3 (search UI), 4 (1,288-book migration), 5 (topics + coverage), 6 (mobile + barcode), 7 (settings polish), 8 (Turabian) — every one is independent of OCR. OCR is purely a velocity multiplier for ref entry.
- **The trip workflow stays under the manual-entry tolerance.** User confirmed the batch UI is "manageable for <100" refs. Trip-period flow is read-a-book, enter-a-page-of-refs at a time — well within that bound.
- **Pre-trip squeeze is real.** 10 days to trip; Session 3 (search UI) is the user-visible value that makes the library actually useful for sermon prep on the road. OCR provider experimentation is high-variance and would crowd Session 3.
- **Post-trip slot is natural.** Returning from the trip with paper notes / page photos is exactly OCR's first real test corpus.
- **Insertion point in the post-trip arc:** between Sessions 7 and 8 (order becomes 7 → 9 → 8). Session 7's translator-data migration runs before OCR-extracted refs touch citation paths, and Session 8's Turabian generator runs against both manual and OCR-extracted refs from day one.

**Trigger to revisit before fall:** first time you have 100+ unentered refs from a single sitting OR returning from trip with paper notes. Until that trigger fires, OCR stays deferred even if the post-trip buffer has open hours — provider experimentation without a real corpus is a worse use of the time than Session 7 / 8 polish or starting on the next module's Session 0.

## Schema changes

- [`20260429180000_compute_verse_abs_chapter_only_fix.sql`](../../supabase/migrations/20260429180000_compute_verse_abs_chapter_only_fix.sql) — replaces `compute_verse_abs()`, recomputes `verse_*_abs` on all live rows. Applied 2026-04-29 via `supabase db push`. Types regenerated (no public-schema diff; the change is in a function body).

## New components / patterns added

- **Pattern: shared component for single-edit + bulk-create entity sub-forms.** Drives `existingRef → mode='edit' (1 row, no controls)` vs `existingRef === null → mode='batch' (N rows, Add/Duplicate/Remove)`. Hidden inputs emit the legacy single-row contract in edit mode; a single `rows_json` JSON array in batch mode. Server keeps two endpoints because update has parent-immutability semantics that bulk insert doesn't. Reuse target: any future "child rows of a parent entity" form (book topics, ancient coverage rows, etc.).
- **Pattern: empty-row tolerance in batch parsers.** Server-side parser silently skips rows where the user-relevant required fields are all blank. Avoids the "you have a trailing empty row, please remove it" friction users hit when duplicating rows.

## Open questions surfaced

- **OCR provider choice** (Tracker_1 Open Question 7) — still unresolved; resolves at start of OCR session.
- **Per-row image override** — not implemented; revisit only if a user reports needing different page images per row in the same batch.
- **Open-ended chapter-to-end-of-book intent** — currently encoded by setting `chapter_end` to the last chapter of the book. If users repeatedly express the open-ended intent, add a `scope_kind` column rather than overloading null semantics.

## Surprises (read these before the next session)

21. **`UPDATE … SET col = col` is the canonical way to refire a `BEFORE UPDATE OF col` trigger.** Postgres treats it as a real update; the trigger function runs with `NEW = OLD` for that column, but the function's body still recomputes derived columns from the actual NEW values (which include unchanged + newly-derived fields). Cleaner than writing an explicit recompute query that has to mirror the trigger's CASE branches.
22. **Read-only MCP transactions reject INSERT before they reach `ROLLBACK`.** The diagnostic's `BEGIN; INSERT…; UPDATE…; ROLLBACK;` shape is fine in Studio but unusable through the read-only MCP path because Postgres rejects the INSERT immediately under `default_transaction_read_only`. The mitigation isn't to drop read-only — it's to keep using Studio for diagnostic SQL and use MCP for verification SELECTs.

## Carry-forward updates

- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 2 row updated; bulk-entry + OCR-design follow-up annotated.
- [x] [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc) — chapter-only semantics + batch-form pattern noted.
- [x] No new env vars introduced. (OCR provider env var lands when the OCR session starts.)
