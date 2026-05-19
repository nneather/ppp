-- =============================================================================
-- Seed canonical scholarly publishers (idempotent).
-- =============================================================================

WITH parent_rows AS (
	INSERT INTO public.publishers (canonical_name, default_location, aliases, notes)
	SELECT v.canonical_name, v.default_location, v.aliases, NULL
	FROM (
		VALUES
			(
				'IVP',
				'Downers Grove, IL',
				ARRAY[
					'InterVarsity Press',
					'Inter-Varsity Press',
					'IVP Books',
					'InterVarsity'
				]::text[]
			),
			(
				'Baker Publishing Group',
				'Grand Rapids, MI',
				ARRAY[
					'Baker Publishing',
					'Baker Book House',
					'Baker Books Publishing'
				]::text[]
			),
			(
				'Eerdmans',
				'Grand Rapids, MI',
				ARRAY[
					'Wm. B. Eerdmans Publishing Co.',
					'Wm. B. Eerdmans Publishing Co',
					'Wm B Eerdmans Publishing Co',
					'Eerdmans Publishing',
					'William B. Eerdmans Publishing Company'
				]::text[]
			),
			(
				'Zondervan',
				'Grand Rapids, MI',
				ARRAY['Zondervan Publishing', 'Zondervan Publishing House']::text[]
			),
			(
				'Crossway',
				'Wheaton, IL',
				ARRAY['Crossway Books', 'Good News Publishers']::text[]
			),
			(
				'Oxford University Press',
				'Oxford',
				ARRAY['OUP', 'Oxford Univ Press', 'Oxford Univ. Press']::text[]
			),
			(
				'Cambridge University Press',
				'Cambridge',
				ARRAY['CUP', 'Cambridge Univ Press', 'Cambridge Univ. Press']::text[]
			),
			(
				'Bloomsbury',
				'London',
				ARRAY['Bloomsbury Publishing', 'Bloomsbury Academic']::text[]
			),
			(
				'Westminster John Knox',
				'Louisville, KY',
				ARRAY['WJK', 'Westminster John Knox Press', 'Westminster/John Knox']::text[]
			),
			(
				'Hendrickson',
				'Peabody, MA',
				ARRAY['Hendrickson Publishers', 'Hendrickson Publishing']::text[]
			),
			(
				'Lexham Press',
				'Bellingham, WA',
				ARRAY['Lexham', 'Faithlife']::text[]
			),
			(
				'P&R Publishing',
				'Phillipsburg, NJ',
				ARRAY['Presbyterian and Reformed', 'P & R Publishing', 'P and R Publishing']::text[]
			)
	) AS v(canonical_name, default_location, aliases)
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL
			AND p.canonical_name = v.canonical_name
	)
	RETURNING id, canonical_name
),
child_rows AS (
	INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
	SELECT v.canonical_name, pr.id, v.default_location, v.aliases
	FROM (
		VALUES
			(
				'IVP Academic',
				'IVP',
				'Downers Grove, IL',
				ARRAY['InterVarsity Press Academic', 'IVP Academic Books']::text[]
			),
			(
				'Baker Academic',
				'Baker Publishing Group',
				'Grand Rapids, MI',
				ARRAY[
					'Baker Academic, a division of Baker Publishing Group',
					'Baker Academic Books'
				]::text[]
			),
			(
				'Baker Books',
				'Baker Publishing Group',
				'Grand Rapids, MI',
				ARRAY['Baker Books, a division of Baker Publishing Group']::text[]
			),
			(
				'Brazos Press',
				'Baker Publishing Group',
				'Grand Rapids, MI',
				ARRAY['Brazos', 'Brazos Press, a division of Baker Publishing Group']::text[]
			),
			(
				'Zondervan Academic',
				'Zondervan',
				'Grand Rapids, MI',
				ARRAY['Zondervan Academic Books']::text[]
			),
			(
				'T&T Clark',
				'Bloomsbury',
				'London',
				ARRAY['T and T Clark', 'T & T Clark', 'T&T Clark International']::text[]
			),
			(
				'Logos / Faithlife',
				'Lexham Press',
				'Bellingham, WA',
				ARRAY['Logos Bible Software', 'Faithlife Corporation']::text[]
			)
	) AS v(canonical_name, parent_canonical, default_location, aliases)
	INNER JOIN public.publishers pr
		ON pr.canonical_name = v.parent_canonical
		AND pr.deleted_at IS NULL
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL
			AND p.canonical_name = v.canonical_name
	)
	RETURNING id
)
SELECT 1;
