-- ppp_projects_v1.sql
-- Projects module — Session 1 schema.
-- Tables: projects (self-referential hierarchy), project_updates, project_links.
-- project_tasks ships in its own migration in Session 3 (footgun #4: immutable filenames;
-- don't add a table whose shape isn't locked).
--
-- Apply: staging -> verify (\d, seed count) -> prod, via `supabase db push`.
-- Hosted-only; no local reset (footgun #6).
--
-- Reuses existing prod objects:
--   public.profiles(id, role)                      -- role IN ('owner','viewer')
--   public.user_permissions(user_id, module, access_level)
--   public.set_updated_at()                        -- updated_at trigger fn (attach per table)
--   public.write_audit_log()                       -- audit trigger TARGET fn; DO NOT redefine here
--   public.app_is_owner()                          -- owner RLS helper
--   public.app_has_module_read(p_module text)      -- read-or-better RLS helper (library pattern)
--   public.app_is_viewer_writer(p_module text)     -- write RLS helper (used only when viewer write is enabled)

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. projects (self-referential hierarchy)
-- ───────────────────────────────────────────────────────────────────────────
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.projects(id),          -- NULL = top-level domain (root)
  name             text not null,
  description      text,
  lifecycle_status text not null
                     check (lifecycle_status in ('idea','active','paused','done','archived'))
                     default 'active',
  start_date       date,                                          -- nullable; not needed for initial load
  end_date         date,                                          -- nullable; NULL = ongoing
  sort_order       int  not null default 0,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id)
);

create index projects_parent_idx    on public.projects (parent_id)        where deleted_at is null;
create index projects_lifecycle_idx on public.projects (lifecycle_status) where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. project_updates  (one manually-set health status per node per week)
-- ───────────────────────────────────────────────────────────────────────────
create table public.project_updates (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id),
  week_of       date not null,                                    -- civil Sunday (week start)
  health_status text not null
                  check (health_status in ('excellent','satisfactory','watch','serious','critical')),
  reason        text,                                             -- markdown
  next_steps    text,                                             -- markdown
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

-- footgun NEW-A: plain UNIQUE would count soft-deleted rows; use a partial unique index.
create unique index project_updates_one_per_week
  on public.project_updates (project_id, week_of) where deleted_at is null;

create index project_updates_latest_idx
  on public.project_updates (project_id, week_of desc);

-- Integrity guard: week_of is a civil DATE and must be a Sunday (Postgres dow: Sunday = 0).
-- Fail-closed posture — a Chicago/UTC off-by-one can't insert two rows a day apart.
-- NOTE: week_of is a DATE (not timestamptz), so dow is unambiguous; week math in the app
-- must compute the civil Chicago Sunday before insert. Drop this CHECK only if a backfill
-- needs non-Sunday dates temporarily (the partial unique above still blocks dupes either way).
alter table public.project_updates
  add constraint project_updates_week_is_sunday
  check (extract(dow from week_of) = 0);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. project_links  (table now; UI in Session 3)
-- ───────────────────────────────────────────────────────────────────────────
create table public.project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url        text not null,
  label      text,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
  -- no deleted_at: lifecycle tied to project; audit_log captures DELETE (mirrors invoice_line_items)
);

create index project_links_project_idx on public.project_links (project_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. triggers (per-table; write_audit_log() is the target fn, not redefined here)
-- ───────────────────────────────────────────────────────────────────────────
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_updates
  for each row execute function public.set_updated_at();

create trigger trg_audit_projects
  after insert or update or delete on public.projects
  for each row execute function public.write_audit_log();
create trigger trg_audit_project_updates
  after insert or update or delete on public.project_updates
  for each row execute function public.write_audit_log();
create trigger trg_audit_project_links
  after insert or update or delete on public.project_links
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS  (owner-only in practice for v1; SELECT pre-wired for a read-only upgrade)
--    Uses the shared helpers from db-changes.mdc — no inline EXISTS against profiles/permissions.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.projects        enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_links   enable row level security;

-- SELECT: owner OR a viewer granted read-or-better on 'projects'.
-- v1 seed leaves projects='none', so app_has_module_read('projects') is false today => owner-only.
-- Flip the seed row to 'read' to grant read access with NO migration.
create policy projects_select on public.projects for select
  using (public.app_is_owner() or public.app_has_module_read('projects'));
create policy project_updates_select on public.project_updates for select
  using (public.app_is_owner() or public.app_has_module_read('projects'));
create policy project_links_select on public.project_links for select
  using (public.app_is_owner() or public.app_has_module_read('projects'));

-- INSERT/UPDATE/DELETE: owner-only for v1.
-- To grant viewer write later, add policies gated on public.app_is_viewer_writer('projects').
create policy projects_write on public.projects for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy project_updates_write on public.project_updates for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy project_links_write on public.project_links for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 6. GRANTs  (footgun #8 — explicit, don't rely on Dashboard auto-expose)
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.projects        to authenticated;
grant select, insert, update, delete on public.project_updates to authenticated;
grant select, insert, update, delete on public.project_links   to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Seed the four root domains
--    Resolve owner via profiles.role (auth.uid() is NULL under service-role — footgun #5).
--    The audit_log row's changed_by may be NULL for these 4 seed inserts; acceptable.
-- ───────────────────────────────────────────────────────────────────────────
insert into public.projects (name, lifecycle_status, created_by)
select v.name, 'active', owner.id
from (values ('Education'), ('Work'), ('Ministry'), ('Personal')) as v(name)
cross join (
  select id from public.profiles where role = 'owner' order by created_at limit 1
) as owner;

commit;
