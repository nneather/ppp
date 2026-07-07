-- Authorless reference works (dictionaries, encyclopedias) cite by title in Turabian;
-- skip the author/editor missing-field flag when set.
ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS no_attributed_author boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.books.no_attributed_author IS
	'When true, auto-review and review-card missing checks skip author/editor requirements (title-first citation).';
