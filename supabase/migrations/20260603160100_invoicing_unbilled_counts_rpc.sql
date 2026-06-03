-- Aggregate unbilled time entries per client (avoids fetching every row in invoicing load).

CREATE OR REPLACE FUNCTION invoicing_unbilled_counts()
RETURNS TABLE (client_id uuid, client_name text, entry_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    te.client_id,
    c.name AS client_name,
    count(*)::bigint AS entry_count
  FROM time_entries te
  INNER JOIN clients c ON c.id = te.client_id AND c.deleted_at IS NULL
  WHERE te.deleted_at IS NULL
    AND te.invoice_id IS NULL
  GROUP BY te.client_id, c.name
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION invoicing_unbilled_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invoicing_unbilled_counts() TO authenticated;
