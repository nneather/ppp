-- =============================================================================
-- Library delta v1
-- Filed: 2026-04-25 (Session 0 → Session 1)
-- Source decision: docs/decisions/002-library-session-0-audit.md (Round 2 = FULL)
--
-- Adds:
--   books.needs_review_note      — review-flag explanation
--   books.page_count             — Open Library enrichment target
--   books.language CHECK         — adds 'french' (Joüon, possible Calvin/Barth FR)
--   people.aliases TEXT[]        — fuzzy-match + Turabian disambiguation
--   people.middle_name TEXT      — keeps first_name atomic
--   people.suffix TEXT           — Turabian "Smith, John, Jr."
--   people.deleted_at            — soft-delete (schema-doc convention; baseline gap)
--   series.deleted_at            — soft-delete (schema-doc convention; baseline gap)
--
-- All ALTERs are additive (no data migration). Idempotent via IF NOT EXISTS /
-- DROP CONSTRAINT IF EXISTS guards.
--
-- After applying:
--   npm run supabase:gen-types
-- and commit src/lib/types/database.ts in the same commit.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. books — additive columns + language CHECK update
-- ---------------------------------------------------------------------------

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS needs_review_note TEXT;

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS page_count INT;

-- language CHECK: drop old, recreate with 'french' added
ALTER TABLE public.books
	DROP CONSTRAINT IF EXISTS books_language_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_language_check CHECK (
		language IN ('english','greek','hebrew','latin','german','french','chinese','other')
	);

-- ---------------------------------------------------------------------------
-- 2. people — aliases / middle_name / suffix
-- ---------------------------------------------------------------------------

ALTER TABLE public.people
	ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.people
	ADD COLUMN IF NOT EXISTS middle_name TEXT;

ALTER TABLE public.people
	ADD COLUMN IF NOT EXISTS suffix TEXT;

ALTER TABLE public.people
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. series — soft-delete (schema doc convention says every user-data table
--    has deleted_at, but baseline didn't include it. Real schema gap.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.series
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =============================================================================
-- End of delta v1
-- Note: write_audit_log() update for people-merge non-revertibility is
-- documented in docs/decisions/002-library-session-0-audit.md but deferred
-- to post-trip Session 7 when the merge UI ships.
-- =============================================================================
