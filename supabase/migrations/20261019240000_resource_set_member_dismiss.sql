-- Three membership tiers: include | exclude (not included) | dismiss (gone).
-- Fold Septuagint studies into Language tools. Park Baugh; dismiss Odyssey and
-- the LXX volumes that already live on Septuagint studies from NT tools.

begin;

alter table public.resource_set_members
  drop constraint if exists resource_set_members_kind_check;

alter table public.resource_set_members
  add constraint resource_set_members_kind_check
  check (kind in ('include', 'exclude', 'dismiss'));

-- Septuagint studies sits with the other language sets.
update public.resource_sets rs
set section_id = lang.id,
    kind = 'language',
    sort_order = coalesce(
      (select max(s.sort_order) + 1 from public.resource_sets s
       where s.section_id = lang.id and s.deleted_at is null),
      0
    )
from public.resource_set_sections lang
where rs.slug = 'septuagint-studies'
  and rs.deleted_at is null
  and lang.slug = 'language-tools'
  and lang.deleted_at is null;

update public.resource_set_sections
set deleted_at = now()
where slug = 'septuagint'
  and deleted_at is null;

-- LXX tools on NT are already includes on Septuagint studies: dismiss them here.
update public.resource_set_members m
set kind = 'dismiss'
from public.resource_sets rs, public.books b
where m.set_id = rs.id
  and m.book_id = b.id
  and m.deleted_at is null
  and rs.slug = 'nt-language-tools'
  and rs.deleted_at is null
  and b.deleted_at is null
  and b.title in (
    'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
    'A Greek-English Lexicon of the Septuagint',
    'Discovering the Septuagint',
    'Grammar of Septuagint Greek'
  );

-- Odyssey volumes leave NT language tools altogether.
insert into public.resource_set_members (set_id, book_id, kind, created_by)
select rs.id, b.id, 'dismiss',
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.books b
join public.resource_sets rs on rs.slug = 'nt-language-tools' and rs.deleted_at is null
where b.deleted_at is null
  and b.title in (
    'Odyssey, Volume I: Books 1–12',
    'Odyssey, Volume II: Books 13–24'
  )
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = rs.id and m.book_id = b.id and m.deleted_at is null
  );

update public.resource_set_members m
set kind = 'dismiss'
from public.resource_sets rs, public.books b
where m.set_id = rs.id
  and m.book_id = b.id
  and m.deleted_at is null
  and rs.slug = 'nt-language-tools'
  and rs.deleted_at is null
  and b.deleted_at is null
  and b.title in (
    'Odyssey, Volume I: Books 1–12',
    'Odyssey, Volume II: Books 13–24'
  );

-- Baugh stays visible as Not included.
insert into public.resource_set_members (set_id, book_id, kind, created_by)
select rs.id, b.id, 'exclude',
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.books b
join public.resource_sets rs on rs.slug = 'nt-language-tools' and rs.deleted_at is null
where b.deleted_at is null
  and b.title = 'A New Testament Greek Primer'
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = rs.id and m.book_id = b.id and m.deleted_at is null
  );

update public.resource_set_members m
set kind = 'exclude'
from public.resource_sets rs, public.books b
where m.set_id = rs.id
  and m.book_id = b.id
  and m.deleted_at is null
  and rs.slug = 'nt-language-tools'
  and rs.deleted_at is null
  and b.deleted_at is null
  and b.title = 'A New Testament Greek Primer'
  and m.kind <> 'exclude';

commit;
