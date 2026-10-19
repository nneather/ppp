-- A set member can stay in the set and stay out of import / the bibliography.
-- Concordances already in the language-tool and Septuagint sets start that way.
-- book_bible_coverage is unchanged (still no deleted_at).

begin;

alter table public.resource_set_members
  add column if not exists bibliographical boolean not null default true;

update public.resource_set_members m
set bibliographical = false
from public.books b
where m.book_id = b.id
  and m.deleted_at is null
  and m.kind = 'include'
  and b.deleted_at is null
  and b.title ilike '%concordance%';

insert into public.resource_set_members (set_id, book_id, kind, bibliographical, created_by)
select rs.id, b.id, 'include', false,
  (select id from public.profiles where role = 'owner' order by created_at limit 1)
from public.books b
join public.resource_sets rs
  on rs.deleted_at is null
 and (
   (rs.slug = 'nt-language-tools' and b.genre = 'Greek Language Tools')
   or (rs.slug = 'ot-language-tools' and b.genre = 'Hebrew Language Tools')
 )
where b.deleted_at is null
  and b.title ilike '%concordance%'
  and not exists (
    select 1 from public.resource_set_members m
    where m.set_id = rs.id
      and m.book_id = b.id
      and m.deleted_at is null
  );

commit;
