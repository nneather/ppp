-- =============================================================================
-- books.primary_category_id: nullable
-- Filed: 2026-04-28 (Session 1.5b follow-up)
--
-- Per-user-decision: it should be possible to add a book without picking a
-- primary category at entry time (categorization can happen later from the
-- review queue or a settings page). Schema today requires NOT NULL; relax it.
--
-- All existing rows have a non-null value, so this is a pure constraint
-- relaxation — no backfill required.
--
-- Idempotent — uses DROP NOT NULL, which is a no-op if already dropped.
-- =============================================================================

ALTER TABLE public.books
	ALTER COLUMN primary_category_id DROP NOT NULL;
