-- =============================================================================
-- ppp — Session 1 seed: clients + client_rates
-- =============================================================================
-- Run once in Supabase SQL Editor (or psql) as a role that bypasses RLS
-- (e.g. postgres / service role). Authenticated "SQL as user" may fail RLS
-- on INSERT depending on your policies.
--
-- BEFORE RUNNING:
-- 1. Replace REPLACE_CLIENT_* names with your real client display names.
-- 2. Replace REPLACE_EMAIL_* / REPLACE_CONTACT_* or keep NULL.
-- 3. Replace REPLACE_RATE_* (numeric) and REPLACE_EFFECTIVE_FROM_* (DATE)
--    with your real billing rates and project start dates (YYYY-MM-DD).
-- 4. Ensure at least one owner row exists in profiles (role = 'owner').
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
	INSERT INTO clients (name, email, billing_contact, created_by)
	SELECT v.name, v.email, v.billing_contact, o.id
	FROM
		owner o
		CROSS JOIN (
			VALUES
				(
					'This Week Health'::text,
					NULL::text,
					NULL::text
				),
				(
					'Fountain of Life Church'::text,
					NULL::text,
					NULL::text
				)
		) AS v(name, email, billing_contact)
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
			('This Week Health'::text, 0.00::numeric(10, 2), '2025-09-01'::date),
			('Fountain of Life Church'::text, 0.00::numeric(10, 2), '2025-06-01'::date)
	) AS v(client_name, rate, effective_from) ON v.client_name = i.name;

-- Verify (optional): owner should see rows; anon should not.
-- SELECT * FROM clients WHERE deleted_at IS NULL;
-- SELECT * FROM client_rates WHERE deleted_at IS NULL;
