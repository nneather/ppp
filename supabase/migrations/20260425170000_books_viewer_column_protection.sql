-- =============================================================================
-- Books — viewer column protection (B1, B2)
-- Filed: 2026-04-25 (Session 1.5 follow-up — Track D)
--
-- Postgres has no native column-level RLS. The viewer role can `UPDATE` rows
-- in `books` per `app_is_viewer_writer('library')`, but per the Session 0
-- audit doc B1/B2 resolution they must NOT change `personal_notes` or
-- `rating` — those columns are owner-personal.
--
-- Defense-in-depth strategy:
--   1. Database trigger (this file) raises EXCEPTION if a non-owner attempts
--      to change either column. This is the security guarantee.
--   2. App-layer strip in updateBookAction (book-actions.ts) drops both fields
--      from the UPDATE payload when the actor is a viewer, so the form submit
--      is silent and clean (never hits the trigger). Defensive UX only.
--
-- Idempotent — uses CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_books_viewer_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_enforce_books_viewer_columns ON public.books;

CREATE TRIGGER trg_enforce_books_viewer_columns
	BEFORE UPDATE ON public.books
	FOR EACH ROW EXECUTE FUNCTION public.enforce_books_viewer_columns();

COMMENT ON TRIGGER trg_enforce_books_viewer_columns ON public.books IS
	'Books B1/B2: viewer cannot mutate personal_notes or rating. Owner bypass via app_is_owner().';
