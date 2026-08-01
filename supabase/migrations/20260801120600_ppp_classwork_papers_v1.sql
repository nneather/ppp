-- ppp_classwork_papers_v1.sql
-- Classwork research papers Session 1 — papers + paper_research_groups + paper_sources.
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.
-- Phase 0: docs/decisions/188-classwork-research-papers-session-0.md
-- No new module_registry slug — papers ride the existing 'classwork' module.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. papers
-- ───────────────────────────────────────────────────────────────────────────
create table public.papers (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'in_progress', 'submitted')),
  course_id       uuid references public.courses(id),
  assignment_id   uuid references public.assignments(id),
  due_date        date,
  topic           text,
  passage_display text,
  notes           text,
  sort_order      int not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index papers_course_id_idx
  on public.papers (course_id)
  where deleted_at is null;

create index papers_assignment_id_idx
  on public.papers (assignment_id)
  where deleted_at is null;

create index papers_status_idx
  on public.papers (status)
  where deleted_at is null;

-- 1:1 with an assignment while live (orphans allowed).
create unique index papers_assignment_id_live_key
  on public.papers (assignment_id)
  where assignment_id is not null and deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. paper_research_groups (schema ships now; UI is Papers Session 2)
-- ───────────────────────────────────────────────────────────────────────────
create table public.paper_research_groups (
  id           uuid primary key default gen_random_uuid(),
  paper_id     uuid not null references public.papers(id),
  name         text not null,
  sort_order   int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

create index paper_research_groups_paper_id_idx
  on public.paper_research_groups (paper_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. paper_sources (book XOR essay; unique per paper while live)
-- ───────────────────────────────────────────────────────────────────────────
create table public.paper_sources (
  id           uuid primary key default gen_random_uuid(),
  paper_id     uuid not null references public.papers(id),
  group_id     uuid references public.paper_research_groups(id),
  book_id      uuid references public.books(id),
  essay_id     uuid references public.essays(id),
  notes        text,
  sort_order   int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  constraint paper_sources_book_xor_essay
    check (
      (book_id is not null and essay_id is null)
      or (book_id is null and essay_id is not null)
    )
);

create index paper_sources_paper_id_idx
  on public.paper_sources (paper_id)
  where deleted_at is null;

create index paper_sources_group_id_idx
  on public.paper_sources (group_id)
  where deleted_at is null;

create index paper_sources_book_id_idx
  on public.paper_sources (book_id)
  where deleted_at is null;

create index paper_sources_essay_id_idx
  on public.paper_sources (essay_id)
  where deleted_at is null;

create unique index paper_sources_paper_book_live_key
  on public.paper_sources (paper_id, book_id)
  where book_id is not null and deleted_at is null;

create unique index paper_sources_paper_essay_live_key
  on public.paper_sources (paper_id, essay_id)
  where essay_id is not null and deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger trg_papers_updated_at
  before update on public.papers
  for each row execute function public.set_updated_at();

create trigger trg_paper_research_groups_updated_at
  before update on public.paper_research_groups
  for each row execute function public.set_updated_at();

create trigger trg_paper_sources_updated_at
  before update on public.paper_sources
  for each row execute function public.set_updated_at();

create trigger trg_audit_papers
  after insert or update or delete on public.papers
  for each row execute function public.write_audit_log();

create trigger trg_audit_paper_research_groups
  after insert or update or delete on public.paper_research_groups
  for each row execute function public.write_audit_log();

create trigger trg_audit_paper_sources
  after insert or update or delete on public.paper_sources
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS (same shape as courses / assignments — module 'classwork')
-- ───────────────────────────────────────────────────────────────────────────
alter table public.papers                enable row level security;
alter table public.paper_research_groups enable row level security;
alter table public.paper_sources         enable row level security;

create policy papers_select on public.papers for select
  using (public.app_is_owner() or public.app_has_module_read('classwork'));
create policy paper_research_groups_select on public.paper_research_groups for select
  using (public.app_is_owner() or public.app_has_module_read('classwork'));
create policy paper_sources_select on public.paper_sources for select
  using (public.app_is_owner() or public.app_has_module_read('classwork'));

create policy papers_write on public.papers for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy paper_research_groups_write on public.paper_research_groups for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy paper_sources_write on public.paper_sources for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 6. GRANTs
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.papers                to authenticated, service_role;
grant select, insert, update, delete on public.paper_research_groups to authenticated, service_role;
grant select, insert, update, delete on public.paper_sources         to authenticated, service_role;
grant select on public.papers                to anon;
grant select on public.paper_research_groups to anon;
grant select on public.paper_sources         to anon;

commit;
