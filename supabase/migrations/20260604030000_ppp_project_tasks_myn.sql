-- project_tasks — MYN (Master Your Now) urgency zones + start-date engine.
-- Session 3; separate migration (footgun #4: immutable filenames).
-- Apply via `npm run supabase:db:push` (hosted only).

begin;

create table public.project_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id),
  title        text not null,
  priority     text not null
                 check (priority in ('critical_now', 'opportunity_now', 'over_horizon'))
                 default 'opportunity_now',
  start_date   date not null,
  completed_at timestamptz,
  sort_order   int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

create index project_tasks_project_idx
  on public.project_tasks (project_id)
  where deleted_at is null;

create index project_tasks_open_zone_idx
  on public.project_tasks (priority, start_date desc)
  where deleted_at is null and completed_at is null;

create trigger set_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

create trigger trg_audit_project_tasks
  after insert or update or delete on public.project_tasks
  for each row execute function public.write_audit_log();

alter table public.project_tasks enable row level security;

create policy project_tasks_select on public.project_tasks for select
  using (public.app_is_owner() or public.app_has_module_read('projects'));

create policy project_tasks_write on public.project_tasks for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.project_tasks to authenticated;

commit;
