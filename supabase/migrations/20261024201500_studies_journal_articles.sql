-- Journal articles are their own catalog rows. A paper or sermon cites one
-- through study_sources.article_id. Essays stay contributions inside a book.
-- Books stay books. Resource sets stay book XOR essay.

create table public.journal_articles (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  journal_title  text not null,
  volume         text,
  issue          text,
  year           int,
  page_start     text,
  page_end       text,
  doi            text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id)
);

create index journal_articles_title_idx
  on public.journal_articles (title)
  where deleted_at is null;

create table public.journal_article_authors (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.journal_articles(id),
  person_id   uuid not null references public.people(id),
  role        text not null default 'author' check (role = 'author'),
  sort_order  int not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id)
);

create unique index journal_article_authors_live_key
  on public.journal_article_authors (article_id, person_id)
  where deleted_at is null;

create index journal_article_authors_person_id_idx
  on public.journal_article_authors (person_id)
  where deleted_at is null;

create trigger trg_journal_articles_updated_at
  before update on public.journal_articles
  for each row execute function public.set_updated_at();

create trigger trg_journal_article_authors_updated_at
  before update on public.journal_article_authors
  for each row execute function public.set_updated_at();

create trigger trg_audit_journal_articles
  after insert or update or delete on public.journal_articles
  for each row execute function public.write_audit_log();

create trigger trg_audit_journal_article_authors
  after insert or update or delete on public.journal_article_authors
  for each row execute function public.write_audit_log();

alter table public.journal_articles enable row level security;
alter table public.journal_article_authors enable row level security;

create policy journal_articles_select on public.journal_articles for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));
create policy journal_article_authors_select on public.journal_article_authors for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));

create policy journal_articles_write on public.journal_articles for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy journal_article_authors_write on public.journal_article_authors for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.journal_articles to authenticated, service_role;
grant select, insert, update, delete on public.journal_article_authors to authenticated, service_role;
grant select on public.journal_articles to anon;
grant select on public.journal_article_authors to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- study_sources: book XOR essay XOR article
-- ───────────────────────────────────────────────────────────────────────────
alter table public.study_sources
  add column if not exists article_id uuid references public.journal_articles(id);

alter table public.study_sources
  drop constraint if exists paper_sources_book_xor_essay;

alter table public.study_sources
  drop constraint if exists study_sources_catalog_xor;

alter table public.study_sources
  add constraint study_sources_catalog_xor
  check (
    (book_id is not null and essay_id is null and article_id is null)
    or (book_id is null and essay_id is not null and article_id is null)
    or (book_id is null and essay_id is null and article_id is not null)
  );

create index if not exists study_sources_article_id_idx
  on public.study_sources (article_id)
  where deleted_at is null;

create unique index if not exists study_sources_paper_article_live_key
  on public.study_sources (paper_id, article_id)
  where paper_id is not null and article_id is not null and deleted_at is null;

create unique index if not exists study_sources_sermon_article_live_key
  on public.study_sources (sermon_id, article_id)
  where sermon_id is not null and article_id is not null and deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- Move the three book-shaped stubs onto articles, then retire the books.
-- ───────────────────────────────────────────────────────────────────────────
insert into public.journal_articles (
  title, journal_title, volume, issue, year, page_start, page_end, doi, created_by
)
select
  v.title, v.journal_title, v.volume, v.issue, v.year, v.page_start, v.page_end, v.doi,
  b.created_by
from (values
  (
    'Inheritance in Paul and Ephesians',
    'Evangelical Quarterly',
    '54',
    null::text,
    1982,
    '157',
    '162',
    null::text
  ),
  (
    'Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective',
    'Bangalore Theological Forum',
    '50',
    '1',
    2018,
    '152',
    '164',
    null::text
  ),
  (
    'Royal Officials and Court Families: A New Look at the ילדים (Yĕlādîm) in 1 Kings 12',
    'The Biblical Archaeologist',
    '59',
    '4',
    1996,
    '225',
    '232',
    '10.2307/3210564'
  )
) as v(title, journal_title, volume, issue, year, page_start, page_end, doi)
join public.books b
  on b.deleted_at is null
 and b.owned = false
 and b.title = v.title
 and b.personal_notes like 'Journal article:%'
where not exists (
  select 1 from public.journal_articles a
  where a.deleted_at is null
    and a.title = v.title
    and a.journal_title = v.journal_title
);

insert into public.journal_article_authors (article_id, person_id, role, sort_order, created_by)
select a.id, ba.person_id, 'author', ba.sort_order, b.created_by
from public.journal_articles a
join public.books b
  on b.deleted_at is null
 and b.owned = false
 and b.title = a.title
 and b.publisher = a.journal_title
 and b.personal_notes like 'Journal article:%'
join public.book_authors ba
  on ba.book_id = b.id
 and ba.role = 'author'
where a.deleted_at is null
  and not exists (
    select 1 from public.journal_article_authors ja
    where ja.deleted_at is null
      and ja.article_id = a.id
      and ja.person_id = ba.person_id
  );

update public.study_sources ss
set
  article_id = a.id,
  book_id = null,
  notes = case
    when ss.notes like 'Journal article:%' then null
    else ss.notes
  end
from public.books b
join public.journal_articles a
  on a.deleted_at is null
 and a.title = b.title
 and a.journal_title = b.publisher
where ss.book_id = b.id
  and ss.deleted_at is null
  and b.deleted_at is null
  and b.owned = false
  and b.personal_notes like 'Journal article:%';

update public.books b
set deleted_at = now()
where b.deleted_at is null
  and b.owned = false
  and b.personal_notes like 'Journal article:%'
  and b.title in (
    'Inheritance in Paul and Ephesians',
    'Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective',
    'Royal Officials and Court Families: A New Look at the ילדים (Yĕlādîm) in 1 Kings 12'
  )
  and not exists (
    select 1 from public.study_sources ss
    where ss.deleted_at is null
      and ss.book_id = b.id
  );
