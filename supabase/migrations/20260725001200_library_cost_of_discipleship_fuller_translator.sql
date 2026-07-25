-- library_cost_of_discipleship_fuller_translator
-- Attach R. H. Fuller as translator on Scribner Cost of Discipleship.
-- Title page: "Translated … by R. H. Fuller, with some revision by Irmgard Booth"
-- — primary translator only (Booth is reviser, not co-translator). Idempotent.

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('R. H.', NULL::text, 'Fuller')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'translator', 2
FROM public.books b
JOIN public.people p ON p.deleted_at IS NULL
	AND p.first_name = 'R. H.'
	AND p.middle_name IS NULL
	AND p.last_name = 'Fuller'
WHERE b.id = '1a886166-c957-4640-93c2-d03de79bc661'::uuid
	AND b.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id
			AND ba.person_id = p.id
			AND ba.role = 'translator'
	);
