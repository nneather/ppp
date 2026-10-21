-- Stored article-stripped title key so /library can page in one query.
-- Must match titleSortKey() in src/lib/library/title-sort.ts (EN + DE articles,
-- repeated, then lower). Unit test: title-sort.test.ts.

CREATE OR REPLACE FUNCTION public.library_title_sort_key(p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
	SELECT lower(
		regexp_replace(
			btrim(COALESCE(p_title, '')),
			'^((the|a|an|der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)[[:space:]]+)+',
			'',
			'i'
		)
	);
$$;

REVOKE ALL ON FUNCTION public.library_title_sort_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.library_title_sort_key(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.library_title_sort_key(text) TO authenticated, service_role;

ALTER TABLE public.books
	ADD COLUMN title_sort_key text
	GENERATED ALWAYS AS (public.library_title_sort_key(title)) STORED;

CREATE INDEX books_title_sort_key_live_idx
	ON public.books (title_sort_key, id)
	WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.books.title_sort_key IS
	'Article-stripped lower title for list pagination. Maintained as a stored generated column.';
