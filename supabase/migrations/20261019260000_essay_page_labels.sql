-- Essay pages were integers, so front matter (xiii–xx) could not be stored.
-- Scripture indexes are already text. Arabic values stay digit strings.

ALTER TABLE public.essays
	ALTER COLUMN page_start TYPE text USING page_start::text,
	ALTER COLUMN page_end TYPE text USING page_end::text;
