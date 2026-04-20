-- =============================================================================
-- ppp — Seed data: clients + client_rates
-- =============================================================================
-- Runs automatically via `supabase db reset`.
-- Requires at least one owner row in profiles (role = 'owner').
-- =============================================================================

WITH owner AS (
	SELECT id
	FROM profiles
	WHERE
		role = 'owner'
		AND deleted_at IS NULL
	ORDER BY created_at
	LIMIT 1
),
inserted AS (
	INSERT INTO clients (
		name,
		email,
		billing_contact,
		address_line_1,
		address_line_2,
		created_by
	)
	SELECT
		v.name,
		COALESCE(v.email, ARRAY[]::text[]),
		v.billing_contact,
		v.address_line_1,
		v.address_line_2,
		o.id
	FROM
		owner o
		CROSS JOIN (
			VALUES
				(
					'This Week Health'::text,
					ARRAY[]::text[],
					'Sarah Svartstrom'::text,
					'Edgemere Way S'::text,
					'Naples, FL 34105'::text
				),
				(
					'Fountain of Life Church'::text,
					ARRAY[]::text[],
					NULL::text,
					'633 W. Badger Rd.'::text,
					'Madison, WI 53713'::text
				)
		) AS v(name, email, billing_contact, address_line_1, address_line_2)
	RETURNING
		id,
		name
)
INSERT INTO client_rates (client_id, service_type, rate, effective_from, effective_to, created_by)
SELECT
	i.id,
	NULL::text,
	v.rate,
	v.effective_from,
	NULL::date,
	(SELECT id FROM owner)
FROM
	inserted i
	JOIN (
		VALUES
			('This Week Health'::text, 100.00::numeric(10, 2), '2025-09-01'::date),
			('Fountain of Life Church'::text, 35.00::numeric(10, 2), '2025-06-01'::date)
	) AS v(client_name, rate, effective_from) ON v.client_name = i.name;
