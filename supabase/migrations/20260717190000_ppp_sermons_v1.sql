-- ppp_sermons_v1.sql
-- Sermons module Session 1 — venues, sermons, structured passages + preaching-history seed.
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. sermon_venues
-- ───────────────────────────────────────────────────────────────────────────
create table public.sermon_venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  notes      text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create unique index sermon_venues_name_live_uidx
  on public.sermon_venues (lower(trim(name)))
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. sermons
-- ───────────────────────────────────────────────────────────────────────────
create table public.sermons (
  id              uuid primary key default gen_random_uuid(),
  preached_on     date not null,
  venue_id        uuid references public.sermon_venues(id),
  context_type    text check (context_type is null or context_type in ('church', 'parachurch', 'academic')),
  topic           text,
  passage_display text,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index sermons_preached_on_idx
  on public.sermons (preached_on desc)
  where deleted_at is null;

create index sermons_venue_id_idx
  on public.sermons (venue_id)
  where deleted_at is null;

create index sermons_context_type_idx
  on public.sermons (context_type)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. sermon_passages (structured library hook)
-- ───────────────────────────────────────────────────────────────────────────
create table public.sermon_passages (
  id            uuid primary key default gen_random_uuid(),
  sermon_id     uuid not null references public.sermons(id),
  bible_book    text not null references public.bible_books(name),
  chapter_start int,
  verse_start   int,
  chapter_end   int,
  verse_end     int,
  sort_order    int not null default 0,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

create index sermon_passages_sermon_id_idx
  on public.sermon_passages (sermon_id)
  where deleted_at is null;

create index sermon_passages_bible_book_idx
  on public.sermon_passages (bible_book)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger trg_sermon_venues_updated_at
  before update on public.sermon_venues
  for each row execute function public.set_updated_at();

create trigger trg_sermons_updated_at
  before update on public.sermons
  for each row execute function public.set_updated_at();

create trigger trg_sermon_passages_updated_at
  before update on public.sermon_passages
  for each row execute function public.set_updated_at();

create trigger trg_audit_sermon_venues
  after insert or update or delete on public.sermon_venues
  for each row execute function public.write_audit_log();

create trigger trg_audit_sermons
  after insert or update or delete on public.sermons
  for each row execute function public.write_audit_log();

create trigger trg_audit_sermon_passages
  after insert or update or delete on public.sermon_passages
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.sermon_venues   enable row level security;
alter table public.sermons         enable row level security;
alter table public.sermon_passages enable row level security;

create policy sermon_venues_select on public.sermon_venues for select
  using (public.app_is_owner() or public.app_has_module_read('sermons'));
create policy sermons_select on public.sermons for select
  using (public.app_is_owner() or public.app_has_module_read('sermons'));
create policy sermon_passages_select on public.sermon_passages for select
  using (public.app_is_owner() or public.app_has_module_read('sermons'));

create policy sermon_venues_write on public.sermon_venues for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy sermons_write on public.sermons for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy sermon_passages_write on public.sermon_passages for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 6. GRANTs
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.sermon_venues   to authenticated, service_role;
grant select, insert, update, delete on public.sermons         to authenticated, service_role;
grant select, insert, update, delete on public.sermon_passages to authenticated, service_role;
grant select on public.sermon_venues   to anon;
grant select on public.sermons         to anon;
grant select on public.sermon_passages to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Seed venues + preaching history
--    Owner via profiles.role (auth.uid() NULL under service-role).
-- ───────────────────────────────────────────────────────────────────────────
insert into public.sermon_venues (id, name, created_by)
select v.id, v.name, owner.id
from (
  values
    ('b1000001-0000-4000-8000-000000000001'::uuid, 'F&M InterVarsity'),
    ('b1000001-0000-4000-8000-000000000002'::uuid, 'Timothy Foundation'),
    ('b1000001-0000-4000-8000-000000000003'::uuid, 'Res Pres Madison'),
    ('b1000001-0000-4000-8000-000000000004'::uuid, 'Covenant Seminary'),
    ('b1000001-0000-4000-8000-000000000005'::uuid, 'Lancaster, PA'),
    ('b1000001-0000-4000-8000-000000000006'::uuid, 'Mt. Zion Presbyterian'),
    ('b1000001-0000-4000-8000-000000000007'::uuid, 'Marissa Presbyterian'),
    ('b1000001-0000-4000-8000-000000000008'::uuid, 'Sutter Presbyterian'),
    ('b1000001-0000-4000-8000-000000000009'::uuid, 'Grandcoate Presbyterian')
) as v(id, name)
cross join (
  select id from public.profiles where role = 'owner' order by created_at limit 1
) as owner
on conflict do nothing;

-- Sermons (fixed ids for passage FKs). Typo in source "Manifested Himeslf" preserved in topic.
insert into public.sermons (
  id, preached_on, venue_id, context_type, topic, passage_display, created_by
)
select s.id, s.preached_on::date, s.venue_id, s.context_type, s.topic, s.passage_display, owner.id
from (
  values
    ('b2000001-0000-4000-8000-000000000001'::uuid, '2023-10-25', 'b1000001-0000-4000-8000-000000000001'::uuid, 'parachurch', 'United in Christ', 'Philippians 2:1-11'),
    ('b2000001-0000-4000-8000-000000000002'::uuid, '2023-10-29', 'b1000001-0000-4000-8000-000000000002'::uuid, 'academic', 'Praying with Thanksgiving', 'Colossians 1:3-14'),
    ('b2000001-0000-4000-8000-000000000003'::uuid, '2024-01-05', 'b1000001-0000-4000-8000-000000000002'::uuid, 'academic', 'Go', 'Genesis 12:1-4'),
    ('b2000001-0000-4000-8000-000000000004'::uuid, '2024-02-18', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'The Roadblock of Love', 'Luke 10:25-37'),
    ('b2000001-0000-4000-8000-000000000005'::uuid, '2024-04-28', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'Heirs with Christ', 'Romans 8:12-17'),
    ('b2000001-0000-4000-8000-000000000006'::uuid, '2024-07-28', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'Plans', 'Proverbs 14:17, 29; 15:1; 16:32; 19:11-12; 22:24-25; 25:28'),
    ('b2000001-0000-4000-8000-000000000007'::uuid, '2025-01-25', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'Abram and the Covenant', 'Genesis 15'),
    ('b2000001-0000-4000-8000-000000000008'::uuid, '2025-02-03', 'b1000001-0000-4000-8000-000000000004'::uuid, 'academic', 'Manifested Himeslf in Joyful Fellowship', '1 John 1:1-4'),
    ('b2000001-0000-4000-8000-000000000009'::uuid, '2025-02-24', 'b1000001-0000-4000-8000-000000000004'::uuid, 'academic', 'Christ in every Circumstance', 'Philippians 4:10-13'),
    ('b2000001-0000-4000-8000-00000000000a'::uuid, '2025-06-13', 'b1000001-0000-4000-8000-000000000005'::uuid, 'parachurch', 'Nothing can separate us from God''s love', 'Romans 8:31-39'),
    ('b2000001-0000-4000-8000-00000000000b'::uuid, '2025-08-10', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'The Cost of Our Debt', 'Matthew 18:21-35'),
    ('b2000001-0000-4000-8000-00000000000c'::uuid, '2025-09-07', 'b1000001-0000-4000-8000-000000000006'::uuid, 'church', 'Jesus'' Call to Follow', 'Mark 1:16-34'),
    ('b2000001-0000-4000-8000-00000000000d'::uuid, '2025-09-28', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'The Cost of Our Debt', 'Matthew 18:21-35'),
    ('b2000001-0000-4000-8000-00000000000e'::uuid, '2025-11-02', 'b1000001-0000-4000-8000-000000000006'::uuid, 'church', 'Our Requests to Jesus', 'Mark 5:1-20'),
    ('b2000001-0000-4000-8000-00000000000f'::uuid, '2025-11-18', 'b1000001-0000-4000-8000-000000000004'::uuid, 'academic', 'God''s Call to Go Further', '1 Kings 18'),
    ('b2000001-0000-4000-8000-000000000010'::uuid, '2025-11-23', 'b1000001-0000-4000-8000-000000000008'::uuid, 'church', 'Thankful and Continual Prayer', 'Colossians 1:3-14'),
    ('b2000001-0000-4000-8000-000000000011'::uuid, '2025-11-30', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'Jesus'' Call to Follow', 'Mark 1:16-34'),
    ('b2000001-0000-4000-8000-000000000012'::uuid, '2025-12-02', 'b1000001-0000-4000-8000-000000000004'::uuid, 'academic', 'When You Alone Are the Only One Left', '1 Kings 19'),
    ('b2000001-0000-4000-8000-000000000013'::uuid, '2026-01-18', 'b1000001-0000-4000-8000-000000000009'::uuid, 'church', 'The Last is Better than the First', 'John 2:1-11'),
    ('b2000001-0000-4000-8000-000000000014'::uuid, '2026-01-25', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'The Beginning of a Hymn', 'Jonah 2'),
    ('b2000001-0000-4000-8000-000000000015'::uuid, '2026-02-08', 'b1000001-0000-4000-8000-000000000006'::uuid, 'church', 'This is My Son, Listen to Him', 'Mark 9:2-13'),
    ('b2000001-0000-4000-8000-000000000016'::uuid, '2026-02-15', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'This is My Son, Listen to Him', 'Mark 9:2-13'),
    ('b2000001-0000-4000-8000-000000000017'::uuid, '2026-03-01', 'b1000001-0000-4000-8000-000000000006'::uuid, 'church', 'How to Enter the Kingdom of God', 'Mark 10:1-31'),
    ('b2000001-0000-4000-8000-000000000018'::uuid, '2026-03-08', 'b1000001-0000-4000-8000-000000000009'::uuid, 'church', 'Who Then May Be Saved', 'Mark 10:17-31'),
    ('b2000001-0000-4000-8000-000000000019'::uuid, '2026-03-15', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'Prayer of Faith and Mercy', 'Luke 18:1-14'),
    ('b2000001-0000-4000-8000-00000000001a'::uuid, '2026-04-19', 'b1000001-0000-4000-8000-000000000009'::uuid, 'church', 'Live Worthy of the Calling', 'Ephesians 4:1-16'),
    ('b2000001-0000-4000-8000-00000000001b'::uuid, '2026-05-03', 'b1000001-0000-4000-8000-000000000006'::uuid, 'church', 'An Annointed Body', 'Mark 14:1-42'),
    ('b2000001-0000-4000-8000-00000000001c'::uuid, '2026-05-10', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'Who Will Listen?', '1 Kings 12'),
    ('b2000001-0000-4000-8000-00000000001d'::uuid, '2026-05-17', 'b1000001-0000-4000-8000-000000000009'::uuid, 'church', 'For We Walk By Faith, Not By Sight', '2 Corinthians 5:1-10'),
    ('b2000001-0000-4000-8000-00000000001e'::uuid, '2026-05-24', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'For We Walk By Faith, Not By Sight', '2 Corinthians 5:1-10'),
    ('b2000001-0000-4000-8000-00000000001f'::uuid, '2026-06-14', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'The Word: Foundations to Flourishing', 'Matthew 5:17-20'),
    ('b2000001-0000-4000-8000-000000000020'::uuid, '2026-07-05', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'Barriers to Human Flourishing, Lust', 'Matthew 5:27-30'),
    ('b2000001-0000-4000-8000-000000000021'::uuid, '2026-07-19', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', 'Go, Inquire of the Lord for Me', '2 Chronicles 34'),
    ('b2000001-0000-4000-8000-000000000022'::uuid, '2026-08-09', 'b1000001-0000-4000-8000-000000000003'::uuid, 'church', 'Flourishing and Anxiety', 'Matthew 6:25-34'),
    ('b2000001-0000-4000-8000-000000000023'::uuid, '2026-08-16', 'b1000001-0000-4000-8000-000000000007'::uuid, 'church', null, null),
    ('b2000001-0000-4000-8000-000000000024'::uuid, '2026-09-10', null, 'academic', null, null),
    ('b2000001-0000-4000-8000-000000000025'::uuid, '2026-09-24', null, 'academic', null, null)
) as s(id, preached_on, venue_id, context_type, topic, passage_display)
cross join (
  select id from public.profiles where role = 'owner' order by created_at limit 1
) as owner
on conflict (id) do nothing;

-- Structured passages (skip empty drafts). Proverbs expands to multiple rows.
insert into public.sermon_passages (
  sermon_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, sort_order, created_by
)
select p.sermon_id, p.bible_book, p.chapter_start, p.verse_start, p.chapter_end, p.verse_end, p.sort_order, owner.id
from (
  values
    ('b2000001-0000-4000-8000-000000000001'::uuid, 'Philippians', 2, 1, 2, 11, 0),
    ('b2000001-0000-4000-8000-000000000002'::uuid, 'Colossians', 1, 3, 1, 14, 0),
    ('b2000001-0000-4000-8000-000000000003'::uuid, 'Genesis', 12, 1, 12, 4, 0),
    ('b2000001-0000-4000-8000-000000000004'::uuid, 'Luke', 10, 25, 10, 37, 0),
    ('b2000001-0000-4000-8000-000000000005'::uuid, 'Romans', 8, 12, 8, 17, 0),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 14, 17, 14, 17, 0),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 14, 29, 14, 29, 1),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 15, 1, 15, 1, 2),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 16, 32, 16, 32, 3),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 19, 11, 19, 12, 4),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 22, 24, 22, 25, 5),
    ('b2000001-0000-4000-8000-000000000006'::uuid, 'Proverbs', 25, 28, 25, 28, 6),
    ('b2000001-0000-4000-8000-000000000007'::uuid, 'Genesis', 15, null, null, null, 0),
    ('b2000001-0000-4000-8000-000000000008'::uuid, '1 John', 1, 1, 1, 4, 0),
    ('b2000001-0000-4000-8000-000000000009'::uuid, 'Philippians', 4, 10, 4, 13, 0),
    ('b2000001-0000-4000-8000-00000000000a'::uuid, 'Romans', 8, 31, 8, 39, 0),
    ('b2000001-0000-4000-8000-00000000000b'::uuid, 'Matthew', 18, 21, 18, 35, 0),
    ('b2000001-0000-4000-8000-00000000000c'::uuid, 'Mark', 1, 16, 1, 34, 0),
    ('b2000001-0000-4000-8000-00000000000d'::uuid, 'Matthew', 18, 21, 18, 35, 0),
    ('b2000001-0000-4000-8000-00000000000e'::uuid, 'Mark', 5, 1, 5, 20, 0),
    ('b2000001-0000-4000-8000-00000000000f'::uuid, '1 Kings', 18, null, null, null, 0),
    ('b2000001-0000-4000-8000-000000000010'::uuid, 'Colossians', 1, 3, 1, 14, 0),
    ('b2000001-0000-4000-8000-000000000011'::uuid, 'Mark', 1, 16, 1, 34, 0),
    ('b2000001-0000-4000-8000-000000000012'::uuid, '1 Kings', 19, null, null, null, 0),
    ('b2000001-0000-4000-8000-000000000013'::uuid, 'John', 2, 1, 2, 11, 0),
    ('b2000001-0000-4000-8000-000000000014'::uuid, 'Jonah', 2, null, null, null, 0),
    ('b2000001-0000-4000-8000-000000000015'::uuid, 'Mark', 9, 2, 9, 13, 0),
    ('b2000001-0000-4000-8000-000000000016'::uuid, 'Mark', 9, 2, 9, 13, 0),
    ('b2000001-0000-4000-8000-000000000017'::uuid, 'Mark', 10, 1, 10, 31, 0),
    ('b2000001-0000-4000-8000-000000000018'::uuid, 'Mark', 10, 17, 10, 31, 0),
    ('b2000001-0000-4000-8000-000000000019'::uuid, 'Luke', 18, 1, 18, 14, 0),
    ('b2000001-0000-4000-8000-00000000001a'::uuid, 'Ephesians', 4, 1, 4, 16, 0),
    ('b2000001-0000-4000-8000-00000000001b'::uuid, 'Mark', 14, 1, 14, 42, 0),
    ('b2000001-0000-4000-8000-00000000001c'::uuid, '1 Kings', 12, null, null, null, 0),
    ('b2000001-0000-4000-8000-00000000001d'::uuid, '2 Corinthians', 5, 1, 5, 10, 0),
    ('b2000001-0000-4000-8000-00000000001e'::uuid, '2 Corinthians', 5, 1, 5, 10, 0),
    ('b2000001-0000-4000-8000-00000000001f'::uuid, 'Matthew', 5, 17, 5, 20, 0),
    ('b2000001-0000-4000-8000-000000000020'::uuid, 'Matthew', 5, 27, 5, 30, 0),
    ('b2000001-0000-4000-8000-000000000021'::uuid, '2 Chronicles', 34, null, null, null, 0),
    ('b2000001-0000-4000-8000-000000000022'::uuid, 'Matthew', 6, 25, 6, 34, 0)
) as p(sermon_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, sort_order)
cross join (
  select id from public.profiles where role = 'owner' order by created_at limit 1
) as owner
where exists (
  select 1 from public.sermons s where s.id = p.sermon_id and s.deleted_at is null
)
and not exists (
  select 1 from public.sermon_passages sp
  where sp.sermon_id = p.sermon_id
    and sp.bible_book = p.bible_book
    and sp.sort_order = p.sort_order
    and sp.deleted_at is null
);

commit;
