# 258 — Study attachments (manuscript scans, audio, documents) — parked

**Date:** 2026-10-19
**Module:** studies
**Status:** Parked. Sizing and design sketch only; nothing built. Pick up when Parker wants handwritten sermon/paper pages, audio, or Word documents reachable from `/studies`.

## Why this exists

Most sermon and paper work is done by hand. Parker wants to upload those pages (3–6 for a sermon, up to ~20 for a paper), point at audio where it exists (file or Spotify-style link), and keep paper documents (links or `.docx`). The question was storage cost and shape, not whether to build it.

## Where we stand

- Project is on the Supabase **Free plan** ([066](066-operational-resilience-review.md)): 1 GB storage, 50 MB per file, 5 GB egress/month. Pro ($25/mo): 100 GB storage, 250 GB egress, then ~$0.021/GB-month.
- The private-file pattern already exists and is the template: bucket by SQL migration, path `${userId}/${parentId}/${random}.${ext}`, RLS via `app_is_owner()` / `app_is_viewer_writer()`, 24h signed URLs through `signStorageUrlsLimited` ([`src/lib/library/storage.ts`](../../src/lib/library/storage.ts), [`20260428200000_library_scripture_images_bucket.sql`](../../supabase/migrations/20260428200000_library_scripture_images_bucket.sql)). The scripture bucket already accepts PDF up to 25 MiB.
- `pdfjs-dist` is already in the client bundle ([`pdf-page-render.ts`](../../src/lib/library/pdf-page-render.ts)), so PDF thumbnails and in-app preview add no new dependency.
- Cloudflare R2 is wired for backups (10 GB free, zero egress). It is a fallback if audio outgrows Supabase, but needs presigned-URL plumbing through an Edge Function. Supabase Storage is the right first home.

## Sizing

Handwritten pages as compressed B&W/greyscale scan PDF: ~0.2–0.5 MB/page. Raw color camera JPEG: ~1.5–3 MB/page. That gap is the main lever.

- Sermon (3–6 pp): ~1–2.5 MB as scan PDF; ~5–15 MB as camera JPEGs.
- Paper (≤20 pp): ~4–10 MB as scan PDF; up to ~50 MB as JPEGs (hits the Free per-file cap).
- Year at ~26 sermons + ~8 papers: **~100–200 MB/yr** as scans; **~1 GB/yr** as raw photos.
- Audio: 35 min at 64 kbps mono ≈ 17 MB; 128 kbps ≈ 34 MB; lossless exceeds 50 MB. 26 sermons/yr ≈ **400–900 MB/yr**. This is the budget breaker, not pages.
- Egress is a non-issue at this scale.
- `.docx` files are 50–500 KB; not a cost concern. Browsers cannot render `.docx`; PDFs they can.

## Decided (for the future build)

- **Scans as PDF, not photo sets.** Accept PDF/JPEG/HEIC/WEBP uploads; nudge toward "scan to PDF"; downscale images client-side (the OCR path already rasterizes). On this rule, Free holds 5+ years of pages.
- **Audio links first, files second.** Store a file only when no hosted copy exists; cap at 50 MB; warn above ~25 MB; suggest ~64 kbps mono re-encode.
- **Word documents: `.docx` is the source of truth**, optional PDF sibling for in-app preview (Word → Save as PDF at upload time; no server conversion).
- **One table, one bucket, one component.** Not a per-kind table set.

## Design sketch

- `study_attachments` — paper XOR sermon parent (mirror [`study-parent.ts`](../../src/lib/studies/study-parent.ts)); `kind` in `manuscript | audio | document | link`; `storage_path` XOR `external_url`; `mime_type`, `byte_size`, `page_count`, `title`, `sort_order`; soft delete; `set_updated_at` + audit triggers; explicit API grants. `byte_size` lets `/settings` show storage used vs the 1 GB cap.
- Bucket `studies-attachments`, private, `file_size_limit` 50 MB, mimes: `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/webp`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `audio/mpeg`, `audio/mp4`, `audio/x-m4a`. RLS copied from the scripture bucket with module slug `studies`.
- `<StudyAttachments>` panel on `/studies/papers/[id]` and `/studies/sermons/[id]` beside `<StudySourcesPanel>`: upload from camera/files, paste a link, list with PDF first-page thumbnails, inline `<audio>` for files, outbound link for hosted audio.
- Add `study_attachments` to `_STUDIES_TABLES`; include the table in the R2 dump. Storage objects themselves are not in the dump on Free; acceptable for scans that also exist on paper, worth stating in the panel help text.
- Roughly two sessions: Session 0 locks the kind enum, mime/size policy, audio rule, and viewer RLS; Session 1 ships migration + panel + settings usage line.

## Open questions (answer at pick-up)

- Audio: links-only, or files with the size nudge above? Recommendation: files allowed.
- Will handwritten pages ever feed OCR/transcription (Anthropic vision, same path as scripture index pages)? If yes, storing PDFs now keeps that door open.
- Is Pro worth it regardless (daily backups, PITR, leaked-password protection — all waived as Free-only in [040](040-security-advisor-hardening.md))? If yes, storage sizing stops mattering.

## Carry-forward updates

- [x] PLAN.md — Deferred / someday pointer added
- [ ] components.mdc — nothing added
- [ ] AGENTS.md — nothing added
- [ ] new env vars — none
