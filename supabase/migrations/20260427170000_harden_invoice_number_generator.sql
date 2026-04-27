-- =============================================================================
-- Hotfix: harden generate_invoice_number() against sequence drift.
--
-- Background
-- ----------
-- The baseline RPC was a one-liner over `nextval('invoice_number_seq')`. After
-- the 2026-04-23 data copy from the staging project (8 invoices imported via
-- the SQL Editor / service role), the sequence was left at last_value=1 while
-- the table held suffixes 1..8. Every Generate Invoice click since has tried
-- to reuse INV-2026-0002, INV-2026-0003, ..., tripping
-- `invoices_invoice_number_key` (UNIQUE on invoice_number).
--
-- See diagnose plan: .cursor/plans/diagnose_invoice_number_drift_*.plan.md
-- and docs/decisions/004-invoice-number-drift-hotfix.md
--
-- Fix
-- ---
-- 1. One-shot: setval the sequence to the current max suffix in `invoices`.
-- 2. Replace `generate_invoice_number()` with a self-healing version that:
--    - Takes a transaction-scoped advisory lock so concurrent callers serialize
--      across the heal-then-nextval window.
--    - Recomputes the max suffix actually present in `invoices` and bumps the
--      sequence past it if it has fallen behind. This makes future restores
--      / SQL Editor inserts non-fatal: the next RPC call self-corrects.
--    - Then calls nextval (atomic; concurrency-safe) and formats the string.
--
-- The grant on EXECUTE to `authenticated` (added in
-- 20260413120000_grant_generate_invoice_number.sql) is preserved by
-- CREATE OR REPLACE FUNCTION.
-- =============================================================================

-- 1. One-shot heal so the very next nextval lands on max+1.
SELECT setval(
	'public.invoice_number_seq',
	(SELECT COALESCE(
		MAX(NULLIF(regexp_replace(invoice_number, '^INV-\d{4}-', ''), '')::int),
		0
	) FROM public.invoices),
	true
);

-- 2. Self-healing replacement.
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
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
