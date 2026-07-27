-- MCP Monday-protocol finetune:
--   projects.deferred_until — intentional park (health stays; consumers suppress "degraded")
--   project_tasks.assignment_id — optional classwork link for MCP dedupe
-- Apply: npm run supabase:db:push (hosted).

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. projects.deferred_until
-- ───────────────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists deferred_until date;

comment on column public.projects.deferred_until is
  'When set and strictly after Chicago today, project is intentionally parked: suppress degraded/check-in nag; underlying health_status unchanged. Past/equal dates are inert (no auto-clear).';

create index if not exists projects_deferred_until_idx
  on public.projects (deferred_until)
  where deleted_at is null and deferred_until is not null;

-- Seed: Summer Writing parked until return to St. Louis (2026-08-09).
update public.projects
set deferred_until = '2026-08-09'
where id = '0caf96aa-385f-48e1-a84e-d042ad788e7f'
  and deleted_at is null
  and deferred_until is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. project_tasks.assignment_id → assignments
-- ───────────────────────────────────────────────────────────────────────────
alter table public.project_tasks
  add column if not exists assignment_id uuid references public.assignments(id) on delete set null;

comment on column public.project_tasks.assignment_id is
  'Optional classwork assignment this MYN task tracks. Duplicates at write time are allowed; MCP surfaces both sides for consumer dedupe.';

create index if not exists project_tasks_assignment_id_idx
  on public.project_tasks (assignment_id)
  where deleted_at is null and assignment_id is not null;

-- One-time backfill: "Grade Reflection on Ince" ↔ "Grade Ince Reflection".
update public.project_tasks
set assignment_id = '92310682-accd-4aa3-827e-979ebc42122f'
where id = '90e862e6-27e9-4cf1-bcd2-fb5d687f8b36'
  and deleted_at is null
  and assignment_id is null;

commit;
