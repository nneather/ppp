-- Security Advisor: pin search_path on trigger/utility functions; block anon RPC on
-- SECURITY DEFINER helpers exposed via PostgREST. See docs/decisions/040-security-advisor-hardening.md.

-- ---------------------------------------------------------------------------
-- 1. search_path (function_search_path_mutable)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_revertible_false()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	IF NEW.status IN ('sent', 'paid') AND OLD.status IS DISTINCT FROM NEW.status THEN
		PERFORM set_config('app.force_non_revertible', 'true', true);
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
	v_max_suffix int;
	v_seq_last   bigint;
	v_next       bigint;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext('generate_invoice_number'));

	SELECT COALESCE(
		MAX(NULLIF(regexp_replace(invoice_number, '^INV-\d{4}-', ''), '')::int),
		0
	)
	INTO v_max_suffix
	FROM public.invoices;

	SELECT last_value INTO v_seq_last FROM public.invoice_number_seq;

	IF v_max_suffix >= v_seq_last THEN
		PERFORM setval('public.invoice_number_seq', v_max_suffix, true);
	END IF;

	v_next := nextval('public.invoice_number_seq');

	RETURN 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_publisher_text(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.compute_verse_abs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	NEW.verse_start_abs := CASE
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start
		WHEN NEW.chapter_start IS NOT NULL
		THEN NEW.chapter_start * 1000
		ELSE 0
	END;

	NEW.verse_end_abs := CASE
		WHEN NEW.chapter_end IS NOT NULL AND NEW.verse_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + NEW.verse_end
		WHEN NEW.chapter_end IS NOT NULL
		THEN (NEW.chapter_end * 1000) + 999
		WHEN NEW.chapter_start IS NOT NULL AND NEW.verse_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + NEW.verse_start
		WHEN NEW.chapter_start IS NOT NULL
		THEN (NEW.chapter_start * 1000) + 999
		ELSE 999999
	END;

	RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. REVOKE EXECUTE FROM anon on SECURITY DEFINER functions callable via RPC
--    (anon_security_definer_function_executable)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.app_is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_is_viewer_writer(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_module_access_level(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_has_module_read(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_books_viewer_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.write_audit_log() FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_merge_people(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_merge_publishers(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_merge_ancient_texts(uuid, uuid) FROM anon;

-- Invoice RPC is not SECURITY DEFINER but should not be callable without a session.
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM anon;
