-- Contacts Session 3: touch kind (meet vs card).
-- Cadence stays day-equivalent storage; months/years is UI-only ([181]).

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- contact_touches.kind — meet drives due; card does not
-- ───────────────────────────────────────────────────────────────────────────
alter table public.contact_touches
  add column if not exists kind text;

update public.contact_touches
set kind = 'meet'
where kind is null;

alter table public.contact_touches
  alter column kind set default 'meet';

alter table public.contact_touches
  alter column kind set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contact_touches_kind_check'
      and conrelid = 'public.contact_touches'::regclass
  ) then
    alter table public.contact_touches
      add constraint contact_touches_kind_check
      check (kind in ('meet', 'card'));
  end if;
end $$;

-- Due / last-meet lookups filter kind = 'meet'.
create index if not exists contact_touches_contact_meet_touched_idx
  on public.contact_touches (contact_id, touched_on desc)
  where deleted_at is null and kind = 'meet';

commit;
