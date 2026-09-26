-- Backfill PostgREST role grants missed by the Projects v1 migrations.
--
-- 20260603170000_ppp_projects_v1.sql (projects, project_updates, project_links) and
-- 20260604030000_ppp_project_tasks_myn.sql (project_tasks) granted to `authenticated`
-- only, omitting `service_role` and the `anon` SELECT required by db-changes.mdc.
--
-- Prod is unaffected: those tables DO have anon + service_role access today, but it
-- came from the public schema's DEFAULT PRIVILEGES (Supabase auto-expose), not from
-- the migrations -- both ran AFTER 20260528120000, so the bulk-grants migration never
-- touched them. Supabase ends automatic Data API grants on 2026-10-30, so a replay
-- onto a fresh project (staging fork, DR rebuild) after that date would produce four
-- tables that service_role and the pre-session anon client cannot reach. Per 039's
-- "Surprises", that surfaces as empty data, not an error.
--
-- GRANT is idempotent; this is a no-op wherever the privileges already exist.
-- See docs/decisions/039-supabase-postgrest-api-grants.md.

grant select, insert, update, delete on public.projects        to authenticated, service_role;
grant select, insert, update, delete on public.project_updates to authenticated, service_role;
grant select, insert, update, delete on public.project_links   to authenticated, service_role;
grant select, insert, update, delete on public.project_tasks   to authenticated, service_role;

grant select on public.projects        to anon;
grant select on public.project_updates to anon;
grant select on public.project_links   to anon;
grant select on public.project_tasks   to anon;
