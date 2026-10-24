-- Reading notes on a paper or sermon. A note may name a study source and a
-- page, and may carry a verse anchor. Loose notes (no source) are allowed.
-- Usage stays on study_sources; the app promotes it when a note is saved.

create table if not exists public.study_notes (
  id               uuid primary key default gen_random_uuid(),
  paper_id         uuid references public.papers(id),
  sermon_id        uuid references public.sermons(id),
  source_id        uuid references public.study_sources(id),
  page             text,
  passage_display  text,
  bible_book       text references public.bible_books(name),
  chapter          int,
  verse_start      int,
  verse_end        int,
  body             text not null,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id),
  constraint study_notes_parent_xor check (
    (paper_id is not null and sermon_id is null)
    or (paper_id is null and sermon_id is not null)
  ),
  constraint study_notes_body_not_blank check (length(btrim(body)) > 0),
  constraint study_notes_chapter_positive check (chapter is null or chapter > 0),
  constraint study_notes_verse_positive check (
    (verse_start is null or verse_start > 0)
    and (verse_end is null or verse_end > 0)
  ),
  constraint study_notes_verse_range check (
    verse_end is null or (verse_start is not null and verse_end >= verse_start)
  )
);

create index if not exists study_notes_paper_created_idx
  on public.study_notes (paper_id, created_at desc)
  where deleted_at is null;

create index if not exists study_notes_sermon_created_idx
  on public.study_notes (sermon_id, created_at desc)
  where deleted_at is null;

create index if not exists study_notes_source_id_idx
  on public.study_notes (source_id)
  where deleted_at is null and source_id is not null;

drop trigger if exists trg_study_notes_updated_at on public.study_notes;
create trigger trg_study_notes_updated_at
  before update on public.study_notes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_study_notes on public.study_notes;
create trigger trg_audit_study_notes
  after insert or update or delete on public.study_notes
  for each row execute function public.write_audit_log();

alter table public.study_notes enable row level security;

drop policy if exists study_notes_select on public.study_notes;
create policy study_notes_select on public.study_notes for select
  using (public.app_is_owner() or public.app_has_module_read('studies'));

drop policy if exists study_notes_write on public.study_notes;
create policy study_notes_write on public.study_notes for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.study_notes to authenticated, service_role;
grant select on public.study_notes to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- The submitted Proverbs 31 paper duplicates the archived annotated one.
-- Keep the archived row (it carries the course note). Retire the submitted copy.
-- ───────────────────────────────────────────────────────────────────────────
with dup as (
  select id
  from public.papers
  where deleted_at is null
    and status = 'submitted'
    and title = 'Open Your Mouth for Justice, Not for Intoxication'
)
update public.study_sources s
set deleted_at = now()
from dup
where s.paper_id = dup.id
  and s.deleted_at is null;

with dup as (
  select id
  from public.papers
  where deleted_at is null
    and status = 'submitted'
    and title = 'Open Your Mouth for Justice, Not for Intoxication'
)
update public.study_research_groups g
set deleted_at = now()
from dup
where g.paper_id = dup.id
  and g.deleted_at is null;

with dup as (
  select id
  from public.papers
  where deleted_at is null
    and status = 'submitted'
    and title = 'Open Your Mouth for Justice, Not for Intoxication'
)
update public.paper_passages pp
set deleted_at = now()
from dup
where pp.paper_id = dup.id
  and pp.deleted_at is null;

update public.papers
set deleted_at = now()
where deleted_at is null
  and status = 'submitted'
  and title = 'Open Your Mouth for Justice, Not for Intoxication';

-- One note per non-empty per-source textarea. The column stays; new notes use this table.
insert into public.study_notes (paper_id, sermon_id, source_id, body, created_by, created_at)
select s.paper_id, s.sermon_id, s.id, btrim(s.notes), s.created_by, coalesce(s.updated_at, now())
from public.study_sources s
where s.deleted_at is null
  and s.notes is not null
  and btrim(s.notes) <> ''
  and (s.paper_id is not null or s.sermon_id is not null)
  and not exists (
    select 1
    from public.study_notes n
    where n.deleted_at is null
      and n.source_id = s.id
      and n.body = btrim(s.notes)
  );
