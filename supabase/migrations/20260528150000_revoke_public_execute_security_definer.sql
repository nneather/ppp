-- Security Advisor follow-up: anon inherits EXECUTE via PUBLIC, not only direct anon grants.
-- Prior migration revoked FROM anon only; merge RPCs already used REVOKE FROM PUBLIC.
-- See docs/decisions/040-security-advisor-hardening.md.

-- RLS helpers (authenticated EXECUTE required for policies)
REVOKE EXECUTE ON FUNCTION public.app_is_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_is_viewer_writer(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_module_access_level(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_has_module_read(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_is_viewer_writer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_module_access_level(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_has_module_read(text) TO authenticated;

-- Trigger-only (no app .rpc(); authenticated EXECUTE for INSERT/UPDATE triggers)
REVOKE EXECUTE ON FUNCTION public.enforce_books_viewer_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_books_viewer_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log() TO authenticated;
