-- =============================================================================
-- Re-point books to child imprints when publisher text matches a child of the
-- linked parent; second-chance backfill for books still without publisher_id.
-- Requires normalize_publisher_text from 20260521120200_publishers_backfill.sql.
-- =============================================================================

-- Pass A: upgrade parent-linked books → child when text matches child canonical/alias.
WITH child_candidates AS (
	SELECT
		b.id AS book_id,
		c.id AS child_id,
		c.canonical_name AS child_canonical,
		row_number() OVER (
			PARTITION BY b.id
			ORDER BY length(c.canonical_name) DESC, c.canonical_name ASC
		) AS rn
	FROM public.books b
	INNER JOIN public.publishers parent_p
		ON parent_p.id = b.publisher_id
		AND parent_p.deleted_at IS NULL
	INNER JOIN public.publishers c
		ON c.parent_id = parent_p.id
		AND c.deleted_at IS NULL
	WHERE b.deleted_at IS NULL
		AND b.publisher IS NOT NULL
		AND trim(b.publisher) <> ''
		AND (
			public.normalize_publisher_text(b.publisher) = public.normalize_publisher_text(c.canonical_name)
			OR EXISTS (
				SELECT 1
				FROM unnest(c.aliases) AS alias(alias_text)
				WHERE public.normalize_publisher_text(alias_text) = public.normalize_publisher_text(b.publisher)
			)
		)
)
UPDATE public.books b
SET
	publisher_id = cc.child_id,
	publisher = cc.child_canonical
FROM child_candidates cc
WHERE b.id = cc.book_id
	AND cc.rn = 1;

-- Pass B: second-chance backfill for books still without publisher_id.
WITH candidates AS (
	SELECT
		b.id AS book_id,
		p.id AS publisher_id,
		p.canonical_name,
		row_number() OVER (
			PARTITION BY b.id
			ORDER BY length(p.canonical_name) DESC, (p.parent_id IS NULL) ASC, p.canonical_name ASC
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
SET
	publisher_id = c.publisher_id,
	publisher = c.canonical_name
FROM candidates c
WHERE b.id = c.book_id
	AND c.rn = 1;

-- Align publisher text to canonical for newly linked rows (same rules as original backfill).
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
