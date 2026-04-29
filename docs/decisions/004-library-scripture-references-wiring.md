# 004 — Library scripture references wiring (Session 2)

**Date:** 2026-04-28
**Module:** library
**Tracker session:** Session 2

## Built

- **Detail-page section** at [`src/routes/library/books/[id]/+page.svelte`](../../src/routes/library/books/%5Bid%5D/+page.svelte) — "Scripture references" section below the existing detail grid. Empty state, refs grouped by `bible_book` in canon order (driven by `bible_books.sort_order`), per-row Edit/Delete affordances, `<ConfirmDialog>`-gated soft-delete with optimistic list removal, "+ Add" toggle that reveals the create form. Per-row Edit swaps the card in place for the same `<ScriptureReferenceForm>` component bound to `existingRef`.
- **Form component extension** at [`src/lib/components/scripture-reference-form.svelte`](../../src/lib/components/scripture-reference-form.svelte) — added `existingRef` + `onCancel` props for edit mode (action swaps to `?/updateScriptureRef`, hidden `id` input emitted, header text + button copy flip). Replaced the manual URL TEXT input with a file picker (`accept="image/*" capture="environment"` for mobile camera) that client-side downscales (~2048px JPEG @ q=0.85 via `createImageBitmap` + `<canvas>`) and uploads via the browser supabase client to the new bucket; the resulting object path lands in a hidden `source_image_url` field. Local blob preview while pending; signed-URL preview once persisted.
- **Storage bucket** via [`supabase/migrations/20260428200000_library_scripture_images_bucket.sql`](../../supabase/migrations/20260428200000_library_scripture_images_bucket.sql) — `library-scripture-images`, private, 10 MB cap, allowed mimes `image/jpeg|png|webp|heic`. Four RLS policies on `storage.objects`: SELECT (owner OR viewer-writer can read), INSERT (owner OR viewer-writer AND first path segment matches `auth.uid()`), UPDATE (owner only), DELETE (owner only). Path convention enforced by app code at [`src/lib/library/storage.ts`](../../src/lib/library/storage.ts) (`scriptureImagePath({ userId, bookId, ext })` → `${userId}/${bookId}/${random}.${ext}`).
- **Loaders** in [`src/lib/library/server/loaders.ts`](../../src/lib/library/server/loaders.ts) — `loadBibleBookNames(supabase)` (canon-ordered via `sort_order`) and `loadScriptureRefsForBook(supabase, bookId)` (orders by `verse_start_abs`, generates a 1h signed URL per row that has `source_image_url`).
- **Page-server actions** at [`src/routes/library/books/[id]/+page.server.ts`](../../src/routes/library/books/%5Bid%5D/+page.server.ts) — three 4-line wrappers (`createScriptureRef` / `updateScriptureRef` / `softDeleteScriptureRef`) calling the existing `scripture-actions.ts` helpers shipped in Session 1.5 / Track E.
- **View-model** `ScriptureRefRow` in [`src/lib/types/library.ts`](../../src/lib/types/library.ts) — includes both `source_image_url` (object path) and `source_image_signed_url` (1h signed URL) so the UI can render thumbnails without re-signing.
- **`compute_verse_abs` UPDATE-path diagnostic** at [`supabase/diagnostics/library_compute_verse_abs_update_path.sql`](../../supabase/diagnostics/library_compute_verse_abs_update_path.sql) — `BEGIN; … ROLLBACK;` wrapped DO block that asserts INSERT-baseline + 4 UPDATE paths (toggle `verse_start`, set `chapter_end`/`verse_end`, collapse to chapter-only, collapse to whole-book). RAISE EXCEPTION on mismatch with step number + observed values; otherwise final NOTICE prints "compute_verse_abs UPDATE-path: PASS".

## Decided (non-obvious)

- **Bucket name `library-scripture-images`** (Tracker_1 Open Question 3 resolved). Convention `${module}-${entity}-images`, plural entity, lowercase + dashes — codified in `.cursor/rules/library-module.mdc` so future image surfaces (book cover scans, ancient-text page snippets, etc.) follow the same shape.
- **Path is `${userId}/${bookId}/${ulid}.${ext}`**, with `userId` first because storage RLS enforces self-prefix on INSERT via `(storage.foldername(name))[1] = auth.uid()::text`. `bookId` is informational only (RLS on `scripture_references` already gates which rows can reference which paths).
- **Edit UX is per-row inline toggle** (NOT a single form swap or dedicated edit page). The card swaps in place for the form when Edit is clicked; clicking Edit on a different ref closes the prior editor and opens the new one (single `editingId` source of truth). Reasoning: 10-field form qualifies as "small inline form" under the `.cursor/rules/library-module.mdc` carve-out (the "large entity forms ship as dedicated pages" rule explicitly targets ~20+ fields with junctions); per-row toggle avoids the scroll-jump that a single-form-swap below the list would cause on mobile.
- **Soft-delete UX = `<ConfirmDialog>` + immediate delete + optimistic remove**, NOT the books-style 10s undo toast. Refs are cheap to retype, and the audit log "soft-delete revert" path (Session 1.5) covers accidents. Revisit if it bites.
- **Image upload is client-side via browser supabase client** rather than streaming the file through a SvelteKit form action. Reasoning: form actions max-out at SvelteKit's body size limit, the client has direct credentials anyway under RLS, and we get a free upload-progress UX surface (the `Uploading…` button label) without server hops. The TEXT object path lands in the form's hidden field; the page-server action is a normal text form post.
- **Client-side downscale to ~2048px long edge / JPEG q=0.85** via `createImageBitmap` + canvas. Falls back to uploading the original if `createImageBitmap` throws (HEIC on Safari can do this). 10 MB bucket cap is the upper backstop.
- **`source_image_url` stores the bucket OBJECT PATH, not a signed URL.** Signed URLs expire (1h TTL); the loader regenerates one on every page load. This keeps the DB row stable across re-uploads and avoids stale signed URLs leaking into bookmarks.
- **Bucket SELECT policy is "any library reader",** not "uploader-only". Multi-author / collaborator workflows need to see each other's evidence. The first-segment self-prefix INSERT check is the actual write isolation; reads are open within the module.
- **NO `COMMENT ON POLICY` in the storage migration.** First push 42501'd (`must be owner of relation objects`) — the migration role can CREATE policies on `storage.objects` but not attach comments. Behavior is captured in the migration's header block and this decision record instead.
- **`ScriptureRefRow` omits `verse_start_abs` / `verse_end_abs`.** They're trigger-computed from chapter/verse columns; the UI never reads them. Search consumes them via the `search_scripture_refs(...)` RPC, not via the row shape.

## Schema changes

- [`20260428200000_library_scripture_images_bucket.sql`](../../supabase/migrations/20260428200000_library_scripture_images_bucket.sql) — creates the private `library-scripture-images` bucket + 4 RLS policies on `storage.objects`. Idempotent (`ON CONFLICT DO NOTHING` on the bucket; `DROP POLICY IF EXISTS` before each `CREATE POLICY`). Applied 2026-04-28 via `supabase db push`. Types regenerated (storage tables are excluded from the `public` schema typegen output as expected — no diff in `src/lib/types/database.ts`).

## New components / patterns added

- [`src/lib/library/storage.ts`](../../src/lib/library/storage.ts) — module-level storage constants + `scriptureImagePath(...)` builder. **Pattern**: any new bucket gets a sibling constants file alongside its loader; bucket name + path-builder live in one place so server (signed-URL generation) and client (upload) share the truth.
- **Pattern: `existingRef`-driven inline edit on small entity forms.** When a sub-form is small enough to live inline (≤ ~10 fields), prefer per-row inline toggle over a single shared form swap or a dedicated edit page. Single `editingId` state on the host page; the form takes `existingRef?` + `onCancel?` props and dispatches to `?/createX` vs `?/updateX` based on `existingRef`'s presence. See `<ScriptureReferenceForm>` and the host page's `editingId` state.
- **Pattern: client-side image upload via browser supabase client → bucket-path hidden input → text-only form post.** Avoids streaming bytes through SvelteKit form actions. The form component owns the upload + preview lifecycle; the server action only persists the resulting object path. Re-usable for any future upload surface (book cover scan, ancient-text page snippet, etc.).
- **Pattern: optimistic list with re-sync `$effect`.** Initialize the local `let refs = $state([])`, then `$effect(() => { refs = data.scriptureRefs; })` to hydrate + re-sync after `invalidateAll`. Avoids the `state_referenced_locally` Svelte 5 warning that comes from initializing `$state` directly with a `data.*` reference.
- **Updated [`src/lib/components/scripture-reference-form.svelte`](../../src/lib/components/scripture-reference-form.svelte)** — registered with edit-mode + image-upload affordances in `.cursor/rules/components.mdc`.

## Open questions surfaced

- **Viewer-write smoke test for `storage.objects`** — needs the still-pending viewer auth user UUID. Once that's in place: viewer can SELECT all refs/images, INSERT into their own prefix, and is rejected (RLS) when attempting INSERT into the owner's prefix. Same blocker as the rest of the Session 1/2 viewer-write acceptance lines.
- **OCR / auto-extraction** — schema hooks (`source_image_url`, `confidence_score`, `needs_review`, `review_note`) and the bucket are now wired; the ingest pipeline remains Tracker_1 Session 9 (post-trip, optional).
- **HEIC fallback path on Safari** — when `createImageBitmap(file)` throws we upload the original. The bucket allows `image/heic` so the browser-side rendering will work on Safari but not on Chrome/Firefox without server-side conversion. Acceptable pre-trip; revisit if HEIC files become common in real use.

## Surprises (read these before the next session)

18. **`COMMENT ON POLICY` on `storage.*` requires ownership of the table.** Migration role can `CREATE POLICY` on `storage.objects` but not attach comments to the policies it just created (SQLSTATE 42501). The migration's `CREATE POLICY` succeeded; the trailing COMMENT block aborted the transaction (which rolled back the CREATEs). Re-pushed with the COMMENTs removed and the file's header block now carries the policy semantics in prose. **Lesson**: storage-schema migrations should skip COMMENT ON anything that isn't in `public`.
19. **`$state` initialized directly from a load-data field warns `state_referenced_locally`** in Svelte 5 — even if you `$effect` re-sync below. Pattern that compiles without the warning: initialize to an empty array (or null), then hydrate + re-sync inside the effect body. Catches both first-render and subsequent invalidations.
20. **`bind:this={el}` on a hidden `<form>`** is the cleanest way to drive a destructive form submit from outside a `<ConfirmDialog>` callback. Confirm flow: user clicks Delete on a row → `pendingDeleteId = id` + `confirmDeleteOpen = true` → user confirms → `deleteIdField.value = pendingDeleteId; deleteFormEl.requestSubmit()` → `use:enhance` lifecycle handles the rest (optimistic remove + invalidate). Avoids serializing form state inside the dialog.

## Carry-forward updates

- [x] [`docs/POS_Library_Build_Tracker.md`](../POS_Library_Build_Tracker.md) — Session 2 rows ticked for `<ScriptureReferenceForm>` wiring + explicit UPDATE-path verification + image upload; Open Question 3 resolved.
- [x] [`.cursor/rules/library-module.mdc`](../../.cursor/rules/library-module.mdc) — "Storage buckets" subsection appended (naming convention, path convention, RLS shape, signed-URL TTL).
- [x] [`.cursor/rules/components.mdc`](../../.cursor/rules/components.mdc) — `<ScriptureReferenceForm>` row updated to mention `existingRef` (edit mode) + image upload.
- [x] [`AGENTS.md`](../../AGENTS.md) — library helpers list extended with the new loader entries + `src/lib/library/storage.ts`.
- [x] No new env vars introduced (bucket is created via SQL migration, not CLI).

## Manual smoke checklist (gated on user)

The user runs these end-to-end with the dev server:

- Open `/library/books/<some-id>` → Scripture references section renders empty state OR existing fixture refs grouped by canon-order bible book.
- Click **Add** → form opens; pick "Philippians", chapter 2, verses 1–11, page 358–383 → Save → row appears under a new "Philippians" group; `/settings/audit-log` shows an INSERT row attributed to owner.
- Click **Edit** on the new row → fields pre-fill → change verse_end to 14 → Save → row updates; ref text now reads `Philippians 2:1–14`; audit log shows an UPDATE row with diff.
- Click the photo / file picker on a row's edit form → pick a small image → Uploading… → preview thumbnail appears → Save → reload page → thumbnail renders via signed URL; clicking it opens the full image in a new tab.
- Click **trash icon** on a row → ConfirmDialog → Delete → row vanishes optimistically; refresh → still gone; audit log shows soft-delete; restore via the "Re-delete" / "Restore" affordance still works.
- Paste [`supabase/diagnostics/library_compute_verse_abs_update_path.sql`](../../supabase/diagnostics/library_compute_verse_abs_update_path.sql) into Studio SQL editor → Run → expect 6 NOTICE lines ending with `compute_verse_abs UPDATE-path: PASS (all 5 steps)` and a final `ROLLBACK`.
