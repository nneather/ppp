-- Park a commentary so it stays out of active By book counts and sermon shelves.
-- Owner-personal, same class as books.rating. Essays are owner-write only
-- (essays_owner_all + essays_viewer_select), so no essays column trigger.

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS shelf_dismissed boolean NOT NULL DEFAULT false;

ALTER TABLE public.essays
	ADD COLUMN IF NOT EXISTS shelf_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.books.shelf_dismissed IS
	'Owner-personal. Parked commentaries are omitted from active shelf counts until restored.';

COMMENT ON COLUMN public.essays.shelf_dismissed IS
	'Owner-personal. Parks this commentary essay without parking the parent volume.';

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
			ERRCODE = '42501';
	END IF;

	IF NEW.rating IS DISTINCT FROM OLD.rating THEN
		RAISE EXCEPTION USING
			MESSAGE = 'Viewer cannot edit rating (owner-personal field).',
			ERRCODE = '42501';
	END IF;

	IF NEW.shelf_dismissed IS DISTINCT FROM OLD.shelf_dismissed THEN
		RAISE EXCEPTION USING
			MESSAGE = 'Viewer cannot edit shelf_dismissed (owner-personal field).',
			ERRCODE = '42501';
	END IF;

	RETURN NEW;
END;
$$;

COMMENT ON TRIGGER trg_enforce_books_viewer_columns ON public.books IS
	'Books B1/B2: viewer cannot mutate personal_notes, rating, or shelf_dismissed. Owner bypass via app_is_owner(); NULL auth.uid() bypass for migrations.';

-- Matthew Henry's Commentary (series abbr MHC), all live volumes.
UPDATE public.books AS b
SET shelf_dismissed = true
FROM public.series AS s
WHERE b.series_id = s.id
	AND b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'MHC';
