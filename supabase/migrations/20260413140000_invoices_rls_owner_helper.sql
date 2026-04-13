-- Stable owner check for RLS policies (avoids nested SELECT into profiles under RLS).
-- Fixes "new row violates row-level security policy" on invoices and related tables.

CREATE OR REPLACE FUNCTION public.app_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles p
		WHERE p.id = auth.uid()
			AND p.role = 'owner'
			AND p.deleted_at IS NULL
	);
$$;

GRANT EXECUTE ON FUNCTION public.app_is_owner() TO authenticated;

DROP POLICY IF EXISTS clients_owner_all ON public.clients;
CREATE POLICY clients_owner_all ON public.clients
	FOR ALL
	USING (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS time_entries_owner_all ON public.time_entries;
CREATE POLICY time_entries_owner_all ON public.time_entries
	FOR ALL
	USING (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS invoices_owner_all ON public.invoices;
CREATE POLICY invoices_owner_all ON public.invoices
	FOR ALL
	USING (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS invoice_line_items_owner_all ON public.invoice_line_items;
CREATE POLICY invoice_line_items_owner_all ON public.invoice_line_items
	FOR ALL
	USING (public.app_is_owner())
	WITH CHECK (public.app_is_owner());
