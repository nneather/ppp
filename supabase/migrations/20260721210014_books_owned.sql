-- Research / not-owned stubs: hide from list/search/counts/review by default.
-- Existing rows keep owned=true via DEFAULT. Direct detail URLs and bibliography stay open.
ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS owned boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.books.owned IS
	'False = research/not-owned stub; hidden from list/search/counts/review by default ([101]).';

CREATE INDEX IF NOT EXISTS idx_books_owned_live
	ON public.books (owned)
	WHERE deleted_at IS NULL;
