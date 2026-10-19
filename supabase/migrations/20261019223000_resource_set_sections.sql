-- resource_set_sections — user-facing groups on /studies/sets.
-- Bible books stay locked (the 66 commentary sets). Other sections can take
-- new sets. Septuagint studies leave NT language tools for their own section.
--
-- book_bible_coverage has no deleted_at (hard-delete junction). The sets
-- loader must not filter that column; this migration does not add one.

begin;

create table public.resource_set_sections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null,
  set_kind   text not null check (set_kind in ('bible_book', 'language', 'custom')),
  locked     boolean not null default false,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create unique index resource_set_sections_slug_live_key
  on public.resource_set_sections (slug)
  where deleted_at is null;

create index resource_set_sections_sort_idx
  on public.resource_set_sections (sort_order)
  where deleted_at is null;

create trigger trg_resource_set_sections_updated_at
  before update on public.resource_set_sections
  for each row execute function public.set_updated_at();

create trigger trg_audit_resource_set_sections
  after insert or update or delete on public.resource_set_sections
  for each row execute function public.write_audit_log();

alter table public.resource_set_sections enable row level security;

create policy resource_set_sections_select on public.resource_set_sections for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy resource_set_sections_write on public.resource_set_sections for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.resource_set_sections to authenticated, service_role;
grant select on public.resource_set_sections to anon;

alter table public.resource_sets
  add column section_id uuid references public.resource_set_sections(id);

create index resource_sets_section_id_idx
  on public.resource_sets (section_id)
  where deleted_at is null;

insert into public.resource_set_sections (name, slug, set_kind, locked, sort_order, created_by)
select v.name, v.slug, v.set_kind, v.locked, v.sort_order,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from (
  values
    ('Bible books'::text, 'bible-books'::text, 'bible_book'::text, true, 0),
    ('Language tools'::text, 'language-tools'::text, 'language'::text, false, 1),
    ('Septuagint'::text, 'septuagint'::text, 'custom'::text, false, 2),
    ('Custom'::text, 'custom'::text, 'custom'::text, false, 3)
) as v(name, slug, set_kind, locked, sort_order)
where not exists (
  select 1 from public.resource_set_sections s
  where s.slug = v.slug and s.deleted_at is null
);

update public.resource_sets rs
set section_id = s.id
from public.resource_set_sections s
where rs.section_id is null
  and rs.deleted_at is null
  and s.deleted_at is null
  and s.slug = case rs.kind
    when 'bible_book' then 'bible-books'
    when 'language' then 'language-tools'
    else 'custom'
  end;

alter table public.resource_sets
  alter column section_id set not null;

-- Septuagint studies: the Greek-language-tool volumes that are LXX, plus the
-- Biblical Reference introduction. Texts (Rahlfs, NETS) stay in Bibles.
insert into public.resource_sets (name, slug, kind, rules, default_for, sort_order, section_id, created_by)
select
  'Septuagint studies',
  'septuagint-studies',
  'custom',
  '[]'::jsonb,
  '{}'::text[],
  0,
  s.id,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.resource_set_sections s
where s.slug = 'septuagint'
  and s.deleted_at is null
  and not exists (
    select 1 from public.resource_sets rs
    where rs.slug = 'septuagint-studies' and rs.deleted_at is null
  );

insert into public.resource_set_members (set_id, book_id, kind, created_by)
select rs.id, b.id, 'include',
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.resource_sets rs
join public.books b
  on b.deleted_at is null
 and b.title in (
   'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
   'A Greek-English Lexicon of the Septuagint',
   'Discovering the Septuagint',
   'Grammar of Septuagint Greek',
   'Invitation to the Septuagint'
 )
where rs.slug = 'septuagint-studies'
  and rs.deleted_at is null
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = rs.id and m.book_id = b.id and m.deleted_at is null
  );

-- Sticky excludes so the Greek Language Tools rule no longer surfaces them
-- inside NT language tools.
insert into public.resource_set_members (set_id, book_id, kind, created_by)
select nt.id, b.id, 'exclude',
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.resource_sets nt
join public.books b
  on b.deleted_at is null
 and b.genre = 'Greek Language Tools'
 and b.title in (
   'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
   'A Greek-English Lexicon of the Septuagint',
   'Discovering the Septuagint',
   'Grammar of Septuagint Greek'
 )
where nt.slug = 'nt-language-tools'
  and nt.deleted_at is null
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = nt.id and m.book_id = b.id and m.deleted_at is null
  );

commit;
