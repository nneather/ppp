-- Recurring MYN tasks: series template + instance link.
-- Complete spawns next occurrence; no pre-materialized window.
-- Apply via `npm run supabase:db:push` (hosted only).

begin;

create table public.project_task_series (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id),
  title            text not null,
  priority         text not null
                     check (priority in ('critical_now', 'opportunity_now', 'over_horizon'))
                     default 'opportunity_now',
  notes            text,
  freq             text not null
                     check (freq in ('weekly', 'monthly')),
  interval         int not null default 1
                     check (interval >= 1),
  -- ISO weekday 1=Mon … 7=Sun (weekly); null for monthly
  byweekday        smallint[],
  -- Day of month 1–31 (monthly); null for weekly
  bymonthday       int
                     check (bymonthday is null or (bymonthday >= 1 and bymonthday <= 31)),
  ends             text not null
                     check (ends in ('never', 'after_count', 'on_date'))
                     default 'never',
  ends_count       int
                     check (ends_count is null or ends_count >= 1),
  ends_on          date,
  occurrence_seq   int not null default 1
                     check (occurrence_seq >= 0),
  stopped_at       timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id),
  constraint project_task_series_weekly_days
    check (
      (freq = 'weekly' and byweekday is not null and cardinality(byweekday) >= 1)
      or (freq = 'monthly' and bymonthday is not null)
    ),
  constraint project_task_series_ends_shape
    check (
      (ends = 'never' and ends_count is null and ends_on is null)
      or (ends = 'after_count' and ends_count is not null and ends_on is null)
      or (ends = 'on_date' and ends_on is not null and ends_count is null)
    )
);

comment on table public.project_task_series is
  'MYN recurring task template; instances live in project_tasks with series_id.';

create index project_task_series_project_idx
  on public.project_task_series (project_id)
  where deleted_at is null;

create trigger set_updated_at before update on public.project_task_series
  for each row execute function public.set_updated_at();

create trigger trg_audit_project_task_series
  after insert or update or delete on public.project_task_series
  for each row execute function public.write_audit_log();

alter table public.project_task_series enable row level security;

create policy project_task_series_select on public.project_task_series for select
  using (public.app_is_owner() or public.app_has_module_read('projects'));

create policy project_task_series_write on public.project_task_series for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.project_task_series to authenticated, service_role;
grant select on public.project_task_series to anon;

alter table public.project_tasks
  add column if not exists series_id uuid references public.project_task_series(id),
  add column if not exists series_occurrence int
    check (series_occurrence is null or series_occurrence >= 1);

comment on column public.project_tasks.series_id is
  'Nullable FK to recurring series template; null = one-off task.';
comment on column public.project_tasks.series_occurrence is
  '1-based occurrence index within the series.';

create index if not exists project_tasks_series_open_idx
  on public.project_tasks (series_id)
  where deleted_at is null and completed_at is null and series_id is not null;

commit;
