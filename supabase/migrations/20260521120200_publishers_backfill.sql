-- =============================================================================
-- Normalize publisher strings + backfill books.publisher_id from publishers registry.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_publisher_text(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT trim(both ' ' FROM regexp_replace(
		regexp_replace(
			regexp_replace(
				replace(lower(coalesce(raw, '')), '&', ' and '),
				'\y(publishing\s+group|publishing\s+house|publishers?|publishing|group|holdings?|inc\.?|llc|co\.?|ltd\.?|company|division|imprint|books?)\y',
				' ',
				'gi'
			),
			'[^a-z0-9\s]',
			' ',
			'g'
		),
		'\s+',
		' ',
		'g'
	));
$$;

COMMENT ON FUNCTION public.normalize_publisher_text(text) IS
	'Lowercase imprint root for matching OL/raw publisher strings to publishers.canonical_name / aliases.';

-- Prefer longest canonical_name when multiple rows match (more specific imprint).
WITH candidates AS (
	SELECT
		b.id AS book_id,
		p.id AS publisher_id,
		length(p.canonical_name) AS name_len,
		row_number() OVER (
			PARTITION BY b.id
			ORDER BY length(p.canonical_name) DESC, p.canonical_name ASC
		) AS rn
	FROM public.books b
	INNER JOIN public.publishers p
		ON p.deleted_at IS NULL
	WHERE b.deleted_at IS NULL
		AND b.publisher_id IS NULL
		AND b.publisher IS NOT NULL
		AND trim(b.publisher) <> ''
		AND (
			public.normalize_publisher_text(b.publisher) = public.normalize_publisher_text(p.canonical_name)
			OR EXISTS (
				SELECT 1
				FROM unnest(p.aliases) AS alias(alias_text)
				WHERE public.normalize_publisher_text(alias_text) = public.normalize_publisher_text(b.publisher)
			)
		)
)
UPDATE public.books b
SET publisher_id = c.publisher_id
FROM candidates c
WHERE b.id = c.book_id
	AND c.rn = 1;

-- Optional: align publisher text to canonical when linked.
UPDATE public.books b
SET publisher = p.canonical_name
FROM public.publishers p
WHERE b.publisher_id = p.id
	AND b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND (
		b.publisher IS NULL
		OR public.normalize_publisher_text(b.publisher) = public.normalize_publisher_text(p.canonical_name)
		OR EXISTS (
			SELECT 1
			FROM unnest(p.aliases) AS alias(alias_text)
			WHERE public.normalize_publisher_text(alias_text) = public.normalize_publisher_text(b.publisher)
		)
	);

-- Unmatched books (for manual review): run in SQL editor if needed:
-- SELECT id, title, publisher FROM books
-- WHERE deleted_at IS NULL AND publisher IS NOT NULL AND trim(publisher) <> '' AND publisher_id IS NULL
-- ORDER BY publisher, title;
