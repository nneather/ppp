-- =============================================================================
-- Inspect triggers / functions that may reference NEW.status or OLD.status
-- Run in Supabase SQL Editor when debugging:
--   "record NEW has no field status" on time_entries updates
-- =============================================================================

-- 1) All non-internal triggers on public.time_entries
SELECT
	t.tgname AS trigger_name,
	p.proname AS function_name,
	pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE
	n.nspname = 'public'
	AND c.relname = 'time_entries'
	AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2) Triggers on public.invoices that mention set_revertible or status (by name)
SELECT
	t.tgname AS trigger_name,
	p.proname AS function_name,
	pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE
	n.nspname = 'public'
	AND c.relname = 'invoices'
	AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 3) Public functions whose source references NEW.status / OLD.status (likely bug)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.oid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE
	n.nspname = 'public'
	AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
	AND (
		p.prosrc ILIKE '%new.status%'
		OR p.prosrc ILIKE '%old.status%'
		OR p.prosrc ILIKE '%(new).status%'
		OR p.prosrc ILIKE '%(old).status%'
	);

-- 4) Full definition of a specific function (replace OID from query 3)
-- SELECT pg_get_functiondef(12345::regprocedure);
