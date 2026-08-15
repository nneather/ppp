-- Extend invoicing_unbilled_counts with hours (non-one-off) + amount (all unbilled).
-- Decision: 201-invoicing-analytics-range-one-offs
-- DROP required: CREATE OR REPLACE cannot change OUT/RETURNS TABLE shape.

DROP FUNCTION IF EXISTS public.invoicing_unbilled_counts();

CREATE FUNCTION invoicing_unbilled_counts()
RETURNS TABLE (
	client_id uuid,
	client_name text,
	entry_count bigint,
	hours numeric,
	amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    te.client_id,
    c.name AS client_name,
    count(*)::bigint AS entry_count,
    coalesce(
      sum(CASE WHEN te.is_one_off THEN 0 ELSE te.hours END),
      0
    )::numeric AS hours,
    coalesce(sum(te.hours * te.rate), 0)::numeric AS amount
  FROM time_entries te
  INNER JOIN clients c ON c.id = te.client_id AND c.deleted_at IS NULL
  WHERE te.deleted_at IS NULL
    AND te.invoice_id IS NULL
  GROUP BY te.client_id, c.name
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION invoicing_unbilled_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION invoicing_unbilled_counts() FROM anon;
GRANT EXECUTE ON FUNCTION invoicing_unbilled_counts() TO authenticated;
