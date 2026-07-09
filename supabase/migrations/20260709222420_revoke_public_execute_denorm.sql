-- Security Advisor follow-up: anon inherits EXECUTE via PUBLIC on denorm helpers
-- introduced in 20260603160000 (after the 20260528150000 REVOKE pass).
-- Mirror 20260528150000_revoke_public_execute_security_definer.sql.
-- See docs/decisions/066-operational-resilience-review.md Q13 / D5.

REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.library_refresh_book_list_denorm_trigger() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.library_refresh_book_list_denorm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_refresh_book_list_denorm_trigger() TO authenticated;
