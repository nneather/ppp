-- =============================================================================
-- Books B1/B2 trigger — bypass when auth.uid() is NULL (migration / SQL context)
--
-- supabase db push runs migrations without a JWT; app_is_owner() is false and
-- the prior trigger blocked any UPDATE touching personal_notes/rating.
-- PostgREST always sets auth.uid() for authenticated requests.
--
-- Filename timestamp is before 20260502150000_library_translator_migration.sql
-- so this applies before translator data updates books.personal_notes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_books_viewer_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	-- Migrations and direct SQL without a request JWT — do not apply B1/B2.
	IF auth.uid() IS NULL THEN
		RETURN NEW;
	END IF;

	-- Owner bypasses every check.
	IF public.app_is_owner() THEN
		RETURN NEW;
	END IF;

	IF NEW.personal_notes IS DISTINCT FROM OLD.personal_notes THEN
		RAISE EXCEPTION USING
			MESSAGE = 'Viewer cannot edit personal_notes (owner-personal field).',
			ERRCODE = '42501';  -- insufficient_privilege
	END IF;

	IF NEW.rating IS DISTINCT FROM OLD.rating THEN
		RAISE EXCEPTION USING
			MESSAGE = 'Viewer cannot edit rating (owner-personal field).',
			ERRCODE = '42501';
	END IF;

	RETURN NEW;
END;
$$;

COMMENT ON TRIGGER trg_enforce_books_viewer_columns ON public.books IS
	'Books B1/B2: viewer cannot mutate personal_notes or rating. Owner bypass via app_is_owner(); NULL auth.uid() bypass for migrations.';
