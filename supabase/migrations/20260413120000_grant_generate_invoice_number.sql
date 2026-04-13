-- Allow authenticated API users to allocate invoice numbers via RPC (used by Session 3 app).
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;
