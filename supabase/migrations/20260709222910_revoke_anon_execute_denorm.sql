-- Recovery: 20260709222420 revoked PUBLIC but anon still had an explicit EXECUTE grant
-- (same pattern as 20260528140000 then 20260528150000). Clear both.
REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm_trigger() FROM anon;
GRANT EXECUTE ON FUNCTION public.library_refresh_book_list_denorm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_refresh_book_list_denorm_trigger() TO authenticated;
