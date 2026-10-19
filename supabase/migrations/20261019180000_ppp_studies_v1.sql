-- ppp_studies_v1.sql
-- Studies Session 1 — resource sets, shared study sources, passage role, seeds.
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.
-- Phase 0: docs/decisions/243-studies-session-0.md
--
-- bible_book commentary sets are seeded from public.bible_books (names match
-- src/lib/library/bible-book-names.ts). The Commentary genre is applied by the
-- read-time resolver, not stored as a second rule.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. module_registry
-- ───────────────────────────────────────────────────────────────────────────
insert into public.module_registry (slug, label, sort_order)
values ('studies', 'Studies', 52)
on conflict (slug) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. papers status + topical + secondary passage display
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'papers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.papers drop constraint %I', r.conname);
  end loop;
end $$;

update public.papers
set status = case status
  when 'draft' then 'researching'
  when 'in_progress' then 'drafting'
  else status
end
where status in ('draft', 'in_progress');

alter table public.papers
  add constraint papers_status_check
  check (status in ('researching', 'drafting', 'submitted', 'published', 'archived'));

alter table public.papers alter column status set default 'researching';

alter table public.papers
  add column if not exists topical boolean not null default true;

alter table public.papers
  add column if not exists secondary_passage_display text;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. sermons topical + secondary passage display; passage role
-- ───────────────────────────────────────────────────────────────────────────
alter table public.sermons
  add column if not exists topical boolean not null default false;

alter table public.sermons
  add column if not exists secondary_passage_display text;

alter table public.sermon_passages
  add column if not exists role text not null default 'primary';

alter table public.sermon_passages
  drop constraint if exists sermon_passages_role_check;

alter table public.sermon_passages
  add constraint sermon_passages_role_check
  check (role in ('primary', 'secondary'));

-- ───────────────────────────────────────────────────────────────────────────
-- 4. paper_passages (mirror sermon_passages; studies RLS)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.paper_passages (
  id            uuid primary key default gen_random_uuid(),
  paper_id      uuid not null references public.papers(id),
  bible_book    text not null references public.bible_books(name),
  chapter_start int,
  verse_start   int,
  chapter_end   int,
  verse_end     int,
  role          text not null default 'primary'
                  check (role in ('primary', 'secondary')),
  sort_order    int not null default 0,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

create index if not exists paper_passages_paper_id_idx
  on public.paper_passages (paper_id)
  where deleted_at is null;

create index if not exists paper_passages_bible_book_idx
  on public.paper_passages (bible_book)
  where deleted_at is null;

drop trigger if exists trg_paper_passages_updated_at on public.paper_passages;
create trigger trg_paper_passages_updated_at
  before update on public.paper_passages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_paper_passages on public.paper_passages;
create trigger trg_audit_paper_passages
  after insert or update or delete on public.paper_passages
  for each row execute function public.write_audit_log();

alter table public.paper_passages enable row level security;

drop policy if exists paper_passages_select on public.paper_passages;
create policy paper_passages_select on public.paper_passages for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));

drop policy if exists paper_passages_write on public.paper_passages;
create policy paper_passages_write on public.paper_passages for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.paper_passages to authenticated, service_role;
grant select on public.paper_passages to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. paper_research_groups → study_research_groups (paper XOR sermon)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.paper_research_groups rename to study_research_groups;

alter table public.study_research_groups alter column paper_id drop not null;

alter table public.study_research_groups
  add column if not exists sermon_id uuid references public.sermons(id);

alter table public.study_research_groups
  drop constraint if exists study_research_groups_parent_xor;

alter table public.study_research_groups
  add constraint study_research_groups_parent_xor
  check (
    (paper_id is not null and sermon_id is null)
    or (paper_id is null and sermon_id is not null)
  );

create index if not exists study_research_groups_sermon_id_idx
  on public.study_research_groups (sermon_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. paper_sources → study_sources
-- ───────────────────────────────────────────────────────────────────────────
alter table public.paper_sources rename to study_sources;

alter table public.study_sources alter column paper_id drop not null;

alter table public.study_sources
  add column if not exists sermon_id uuid references public.sermons(id);

alter table public.study_sources
  add column if not exists usage text not null default 'candidate';

alter table public.study_sources
  drop constraint if exists study_sources_usage_check;

alter table public.study_sources
  add constraint study_sources_usage_check
  check (usage in ('candidate', 'consulted', 'cited'));

alter table public.study_sources
  drop constraint if exists study_sources_parent_xor;

alter table public.study_sources
  add constraint study_sources_parent_xor
  check (
    (paper_id is not null and sermon_id is null)
    or (paper_id is null and sermon_id is not null)
  );

drop index if exists paper_sources_paper_book_live_key;
drop index if exists paper_sources_paper_essay_live_key;

create unique index study_sources_paper_book_live_key
  on public.study_sources (paper_id, book_id)
  where paper_id is not null and book_id is not null and deleted_at is null;

create unique index study_sources_paper_essay_live_key
  on public.study_sources (paper_id, essay_id)
  where paper_id is not null and essay_id is not null and deleted_at is null;

create unique index study_sources_sermon_book_live_key
  on public.study_sources (sermon_id, book_id)
  where sermon_id is not null and book_id is not null and deleted_at is null;

create unique index study_sources_sermon_essay_live_key
  on public.study_sources (sermon_id, essay_id)
  where sermon_id is not null and essay_id is not null and deleted_at is null;

create index if not exists study_sources_sermon_id_idx
  on public.study_sources (sermon_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. RLS: papers + groups + sources move from classwork → studies
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists papers_select on public.papers;
drop policy if exists papers_write on public.papers;
create policy papers_select on public.papers for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy papers_write on public.papers for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists paper_research_groups_select on public.study_research_groups;
drop policy if exists paper_research_groups_write on public.study_research_groups;
drop policy if exists study_research_groups_select on public.study_research_groups;
drop policy if exists study_research_groups_write on public.study_research_groups;
create policy study_research_groups_select on public.study_research_groups for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy study_research_groups_write on public.study_research_groups for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists paper_sources_select on public.study_sources;
drop policy if exists paper_sources_write on public.study_sources;
drop policy if exists study_sources_select on public.study_sources;
drop policy if exists study_sources_write on public.study_sources;
create policy study_sources_select on public.study_sources for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy study_sources_write on public.study_sources for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 8. resource_sets + resource_set_members
-- ───────────────────────────────────────────────────────────────────────────
create table public.resource_sets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null,
  kind             text not null check (kind in ('bible_book', 'language', 'custom')),
  rules            jsonb not null default '[]'::jsonb,
  default_for      text[] not null default '{}',
  last_reviewed_at timestamptz,
  sort_order       int not null default 0,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id),
  constraint resource_sets_rules_array check (jsonb_typeof(rules) = 'array'),
  constraint resource_sets_default_for_check check (
    default_for <@ array['sermon', 'paper']::text[]
  )
);

create unique index resource_sets_slug_live_key
  on public.resource_sets (slug)
  where deleted_at is null;

create index resource_sets_kind_idx
  on public.resource_sets (kind, sort_order)
  where deleted_at is null;

create table public.resource_set_members (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references public.resource_sets(id),
  book_id    uuid references public.books(id),
  essay_id   uuid references public.essays(id),
  kind       text not null check (kind in ('include', 'exclude')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  constraint resource_set_members_book_xor_essay
    check (
      (book_id is not null and essay_id is null)
      or (book_id is null and essay_id is not null)
    )
);

create index resource_set_members_set_id_idx
  on public.resource_set_members (set_id)
  where deleted_at is null;

create index resource_set_members_book_id_idx
  on public.resource_set_members (book_id)
  where deleted_at is null;

create index resource_set_members_essay_id_idx
  on public.resource_set_members (essay_id)
  where deleted_at is null;

create unique index resource_set_members_set_book_live_key
  on public.resource_set_members (set_id, book_id)
  where book_id is not null and deleted_at is null;

create unique index resource_set_members_set_essay_live_key
  on public.resource_set_members (set_id, essay_id)
  where essay_id is not null and deleted_at is null;

create trigger trg_resource_sets_updated_at
  before update on public.resource_sets
  for each row execute function public.set_updated_at();

create trigger trg_resource_set_members_updated_at
  before update on public.resource_set_members
  for each row execute function public.set_updated_at();

create trigger trg_audit_resource_sets
  after insert or update or delete on public.resource_sets
  for each row execute function public.write_audit_log();

create trigger trg_audit_resource_set_members
  after insert or update or delete on public.resource_set_members
  for each row execute function public.write_audit_log();

alter table public.resource_sets enable row level security;
alter table public.resource_set_members enable row level security;

create policy resource_sets_select on public.resource_sets for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy resource_set_members_select on public.resource_set_members for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));

create policy resource_sets_write on public.resource_sets for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy resource_set_members_write on public.resource_set_members for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.resource_sets to authenticated, service_role;
grant select, insert, update, delete on public.resource_set_members to authenticated, service_role;
grant select on public.resource_sets to anon;
grant select on public.resource_set_members to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. books.acquired_on (backfill created_at::date)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.books
  add column if not exists acquired_on date;

update public.books
set acquired_on = created_at::date
where acquired_on is null;

alter table public.books
  alter column acquired_on set default current_date;

-- ───────────────────────────────────────────────────────────────────────────
-- 10. Seeds
-- ───────────────────────────────────────────────────────────────────────────
insert into public.resource_sets (name, slug, kind, rules, default_for, sort_order, created_by)
select
  'Commentaries: ' || bb.name,
  'commentaries-' || trim(both '-' from regexp_replace(lower(bb.name), '[^a-z0-9]+', '-', 'g')),
  'bible_book',
  jsonb_build_array(jsonb_build_object('kind', 'bible_book', 'value', bb.name)),
  '{}'::text[],
  bb.sort_order,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.bible_books bb
where not exists (
  select 1
  from public.resource_sets rs
  where rs.deleted_at is null
    and rs.slug = 'commentaries-' || trim(both '-' from regexp_replace(lower(bb.name), '[^a-z0-9]+', '-', 'g'))
);

insert into public.resource_sets (name, slug, kind, rules, default_for, sort_order, created_by)
select
  'NT language tools',
  'nt-language-tools',
  'language',
  '[{"kind":"genre","value":"Greek Language Tools"}]'::jsonb,
  '{}'::text[],
  0,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
where not exists (
  select 1 from public.resource_sets
  where slug = 'nt-language-tools' and deleted_at is null
);

insert into public.resource_sets (name, slug, kind, rules, default_for, sort_order, created_by)
select
  'OT language tools',
  'ot-language-tools',
  'language',
  '[{"kind":"genre","value":"Hebrew Language Tools"}]'::jsonb,
  '{}'::text[],
  1,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
where not exists (
  select 1 from public.resource_sets
  where slug = 'ot-language-tools' and deleted_at is null
);

insert into public.resource_sets (name, slug, kind, rules, default_for, sort_order, created_by)
select
  'Systematic Theology',
  'systematic-theology',
  'custom',
  '[]'::jsonb,
  array['sermon']::text[],
  0,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
where not exists (
  select 1 from public.resource_sets
  where slug = 'systematic-theology' and deleted_at is null
);

-- Static includes: exact title + Systematic Theology genre (multi-volume rows).
insert into public.resource_set_members (set_id, book_id, kind, created_by)
select rs.id, b.id, 'include',
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.resource_sets rs
join public.books b
  on b.deleted_at is null
 and b.genre = 'Systematic Theology'
 and b.title in (
   'Institutes of the Christian Religion',
   'Theoretical-Practical Theology',
   'Reformed Dogmatics',
   'Synopsis of a Purer Theology',
   'Institutes of Elenctic Theology'
 )
where rs.slug = 'systematic-theology'
  and rs.deleted_at is null
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = rs.id
      and m.book_id = b.id
      and m.deleted_at is null
  );

commit;
