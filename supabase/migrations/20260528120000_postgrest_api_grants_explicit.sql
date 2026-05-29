-- Explicit PostgREST role grants on public schema objects.
-- Supabase is defaulting new projects to opt-in API exposure (discussion #45329);
-- existing projects may follow in Oct 2026. Idempotent — safe if default privileges
-- already granted these at table creation time.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $grant_tables$
DECLARE
	t text;
BEGIN
	FOR t IN
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public'
			AND c.relkind = 'r'
	LOOP
		EXECUTE format(
			'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role',
			t
		);
		EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', t);
	END LOOP;
END
$grant_tables$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
