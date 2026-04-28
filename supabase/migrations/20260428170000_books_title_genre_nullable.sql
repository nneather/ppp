-- =============================================================================
-- books.title + books.genre: nullable
-- Filed: 2026-04-28 (Session 1.5c)
--
-- Per-user-decision: ANY field on a book should be skippable at entry time.
-- Use case: barcode-scan adds an ISBN-only stub; user fills in details later.
-- The app layer auto-flags `needs_review = true` and writes a "Missing: …"
-- review note when important identifying fields (title, author, genre, year,
-- publisher) are missing, so the eventual review queue (Tracker_1 Session 6)
-- surfaces these for follow-up.
--
-- All existing rows have non-null title + genre values, so no backfill.
-- Idempotent — `DROP NOT NULL` is a no-op if already dropped.
-- =============================================================================

ALTER TABLE public.books
	ALTER COLUMN title DROP NOT NULL;

ALTER TABLE public.books
	ALTER COLUMN genre DROP NOT NULL;
