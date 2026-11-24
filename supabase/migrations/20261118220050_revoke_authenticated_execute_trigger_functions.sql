-- Security advisor follow-up (authenticated_security_definer_function_executable).
-- handle_new_user() and write_audit_log() are trigger functions only: they are
-- invoked by triggers (on_auth_user_created, audit triggers), never via RPC.
-- Postgres checks EXECUTE only when a trigger is created, not when it fires, and
-- both functions are SECURITY DEFINER, so signed-in users do not need EXECUTE.
-- Removing it stops them being callable at /rest/v1/rpc/*. service_role/postgres keep access.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
