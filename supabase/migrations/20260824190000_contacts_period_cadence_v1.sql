-- Contacts Session 4 — calendar-period cadence, list kinds, household grades,
-- address as-of, period skips, household children.
-- Phase locks: brainstorms/2026-08-24-contacts-semester-invest.md

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. contacts.frequency (+ birthday for people; children have their own table)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.contacts
  add column if not exists frequency text;

update public.contacts
set frequency = case
  when no_reminders then 'common'
  else 'quarterly'
end
where frequency is null;

alter table public.contacts
  alter column frequency set default 'quarterly';

alter table public.contacts
  alter column frequency set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_frequency_check'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_frequency_check
      check (frequency in ('common', 'quarterly', 'semiannual', 'annual', 'none'));
  end if;
end $$;

alter table public.contacts
  add column if not exists birthday date;

create index if not exists contacts_frequency_idx
  on public.contacts (frequency)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. households — grades + address as-of
-- ───────────────────────────────────────────────────────────────────────────
alter table public.households
  add column if not exists giving_grade text;

alter table public.households
  add column if not exists relationship_grade text;

alter table public.households
  add column if not exists address_updated_on date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'households_giving_grade_check'
      and conrelid = 'public.households'::regclass
  ) then
    alter table public.households
      add constraint households_giving_grade_check
      check (giving_grade is null or giving_grade in ('A', 'B', 'C', 'D', 'E'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'households_relationship_grade_check'
      and conrelid = 'public.households'::regclass
  ) then
    alter table public.households
      add constraint households_relationship_grade_check
      check (relationship_grade is null or relationship_grade in ('A', 'B', 'C', 'D'));
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. contact_lists.kind — standing | ad_hoc
-- ───────────────────────────────────────────────────────────────────────────
alter table public.contact_lists
  add column if not exists kind text;

update public.contact_lists
set kind = case
  when lower(name) = 'christmas cards' then 'ad_hoc'
  else 'standing'
end
where kind is null;

alter table public.contact_lists
  alter column kind set default 'standing';

alter table public.contact_lists
  alter column kind set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contact_lists_kind_check'
      and conrelid = 'public.contact_lists'::regclass
  ) then
    alter table public.contact_lists
      add constraint contact_lists_kind_check
      check (kind in ('standing', 'ad_hoc'));
  end if;
end $$;

-- Christmas cards stays ad_hoc; unseeded memberships (Session 5 uses Potential Invite).
update public.contact_lists
set kind = 'ad_hoc',
    notes = coalesce(notes, 'Seasonal mailing — clone yearly; membership is households.')
where name = 'Christmas cards' and deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. contact_period_skips — skip this period (not a meet)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_period_skips (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts(id),
  period_key   text not null,
  skipped_on   date not null,
  note         text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id)
);

create unique index if not exists contact_period_skips_live_uniq
  on public.contact_period_skips (contact_id, period_key)
  where deleted_at is null;

create index if not exists contact_period_skips_contact_idx
  on public.contact_period_skips (contact_id)
  where deleted_at is null;

drop trigger if exists trg_set_updated_at_contact_period_skips on public.contact_period_skips;
create trigger trg_set_updated_at_contact_period_skips
  before update on public.contact_period_skips
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_contact_period_skips on public.contact_period_skips;
create trigger trg_audit_contact_period_skips
  after insert or update or delete on public.contact_period_skips
  for each row execute function public.write_audit_log();

alter table public.contact_period_skips enable row level security;

drop policy if exists contact_period_skips_select on public.contact_period_skips;
create policy contact_period_skips_select on public.contact_period_skips for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists contact_period_skips_write on public.contact_period_skips;
create policy contact_period_skips_write on public.contact_period_skips for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.contact_period_skips to authenticated, service_role;
grant select on public.contact_period_skips to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. household_grade_changes — append-only timeline
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.household_grade_changes (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id),
  changed_on          date not null,
  giving_grade        text,
  relationship_grade  text,
  note                text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'household_grade_changes_giving_check'
      and conrelid = 'public.household_grade_changes'::regclass
  ) then
    alter table public.household_grade_changes
      add constraint household_grade_changes_giving_check
      check (giving_grade is null or giving_grade in ('A', 'B', 'C', 'D', 'E'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'household_grade_changes_rel_check'
      and conrelid = 'public.household_grade_changes'::regclass
  ) then
    alter table public.household_grade_changes
      add constraint household_grade_changes_rel_check
      check (relationship_grade is null or relationship_grade in ('A', 'B', 'C', 'D'));
  end if;
end $$;

create index if not exists household_grade_changes_hh_idx
  on public.household_grade_changes (household_id, changed_on desc)
  where deleted_at is null;

drop trigger if exists trg_set_updated_at_household_grade_changes on public.household_grade_changes;
create trigger trg_set_updated_at_household_grade_changes
  before update on public.household_grade_changes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_household_grade_changes on public.household_grade_changes;
create trigger trg_audit_household_grade_changes
  after insert or update or delete on public.household_grade_changes
  for each row execute function public.write_audit_log();

alter table public.household_grade_changes enable row level security;

drop policy if exists household_grade_changes_select on public.household_grade_changes;
create policy household_grade_changes_select on public.household_grade_changes for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists household_grade_changes_write on public.household_grade_changes;
create policy household_grade_changes_write on public.household_grade_changes for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.household_grade_changes to authenticated, service_role;
grant select on public.household_grade_changes to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. household_children
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.household_children (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id),
  first_name    text not null,
  last_name     text,
  birthday      date,
  notes         text,
  sort_order    int not null default 0,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

create index if not exists household_children_hh_idx
  on public.household_children (household_id, sort_order)
  where deleted_at is null;

drop trigger if exists trg_set_updated_at_household_children on public.household_children;
create trigger trg_set_updated_at_household_children
  before update on public.household_children
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_household_children on public.household_children;
create trigger trg_audit_household_children
  after insert or update or delete on public.household_children
  for each row execute function public.write_audit_log();

alter table public.household_children enable row level security;

drop policy if exists household_children_select on public.household_children;
create policy household_children_select on public.household_children for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists household_children_write on public.household_children;
create policy household_children_write on public.household_children for all
  using (public.app_is_owner()) with check (public.app_is_owner());

grant select, insert, update, delete on public.household_children to authenticated, service_role;
grant select on public.household_children to anon;

commit;
