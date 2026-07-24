-- ppp_classwork_v1.sql
-- Classwork module Session 1 — courses + assignments.
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.
-- Phase 0: docs/decisions/150-classwork-session-0.md

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. courses
-- ───────────────────────────────────────────────────────────────────────────
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text,
  instructor   text,
  term         text,
  status       text not null default 'active'
                 check (status in ('active', 'completed')),
  project_id   uuid references public.projects(id),
  notes        text,
  sort_order   int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

create index courses_status_idx
  on public.courses (status)
  where deleted_at is null;

create index courses_project_id_idx
  on public.courses (project_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. assignments
-- ───────────────────────────────────────────────────────────────────────────
create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id),
  parent_id    uuid references public.assignments(id),
  title        text not null,
  kind         text not null default 'other'
                 check (kind in ('paper', 'exam', 'reading', 'quiz', 'presentation', 'other')),
  status       text not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'done')),
  due_date     date not null,
  completed_at timestamptz,
  notes        text,
  sort_order   int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

create index assignments_course_id_idx
  on public.assignments (course_id)
  where deleted_at is null;

create index assignments_due_date_idx
  on public.assignments (due_date)
  where deleted_at is null;

create index assignments_parent_id_idx
  on public.assignments (parent_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create trigger trg_assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

create trigger trg_audit_courses
  after insert or update or delete on public.courses
  for each row execute function public.write_audit_log();

create trigger trg_audit_assignments
  after insert or update or delete on public.assignments
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.courses     enable row level security;
alter table public.assignments enable row level security;

create policy courses_select on public.courses for select
  using (public.app_is_owner() or public.app_has_module_read('classwork'));
create policy assignments_select on public.assignments for select
  using (public.app_is_owner() or public.app_has_module_read('classwork'));

create policy courses_write on public.courses for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy assignments_write on public.assignments for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 5. GRANTs
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.courses     to authenticated, service_role;
grant select, insert, update, delete on public.assignments to authenticated, service_role;
grant select on public.courses     to anon;
grant select on public.assignments to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. module_registry
-- ───────────────────────────────────────────────────────────────────────────
insert into public.module_registry (slug, label, sort_order)
values ('classwork', 'Classwork', 50)
on conflict (slug) do nothing;

commit;
