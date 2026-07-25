-- ppp_contacts_v1.sql
-- Contacts / CRM Session 1 — households, contacts, touches, lists.
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.
-- Phase 0: docs/decisions/175-contacts-session-0.md
--
-- Hard constraints: ≠ library `people` (authors) and invoicing `clients` (billing).

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 0. profiles — per-user cadence default
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists contact_cadence_days_default int;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. households
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address_line_1  text,
  address_line_2  text,
  city            text,
  state           text,
  postal_code     text,
  country         text,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index if not exists households_name_idx
  on public.households (name)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. contacts
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text,
  household_id    uuid references public.households(id),
  email           text,
  phone           text,
  cadence_days    int,
  no_reminders    boolean not null default false,
  status          text not null default 'active'
                    check (status in ('active', 'retired')),
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index if not exists contacts_status_idx
  on public.contacts (status)
  where deleted_at is null;

create index if not exists contacts_household_id_idx
  on public.contacts (household_id)
  where deleted_at is null;

create index if not exists contacts_no_reminders_idx
  on public.contacts (no_reminders)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. contact_touches
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_touches (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts(id),
  touched_on      date not null,
  note            text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

create index if not exists contact_touches_contact_touched_idx
  on public.contact_touches (contact_id, touched_on desc)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. contact_lists
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_lists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  notes           text,
  sort_order      int not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. contact_list_members (contact XOR household)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_list_members (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.contact_lists(id),
  contact_id      uuid references public.contacts(id),
  household_id    uuid references public.households(id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id),
  constraint contact_list_members_xor_check check (
    (contact_id is not null and household_id is null)
    or (contact_id is null and household_id is not null)
  )
);

create unique index if not exists contact_list_members_list_contact_uidx
  on public.contact_list_members (list_id, contact_id)
  where deleted_at is null and contact_id is not null;

create unique index if not exists contact_list_members_list_household_uidx
  on public.contact_list_members (list_id, household_id)
  where deleted_at is null and household_id is not null;

create index if not exists contact_list_members_list_id_idx
  on public.contact_list_members (list_id)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Triggers
-- ───────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contact_touches_updated_at on public.contact_touches;
create trigger trg_contact_touches_updated_at
  before update on public.contact_touches
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contact_lists_updated_at on public.contact_lists;
create trigger trg_contact_lists_updated_at
  before update on public.contact_lists
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contact_list_members_updated_at on public.contact_list_members;
create trigger trg_contact_list_members_updated_at
  before update on public.contact_list_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_households on public.households;
create trigger trg_audit_households
  after insert or update or delete on public.households
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_contacts on public.contacts;
create trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_contact_touches on public.contact_touches;
create trigger trg_audit_contact_touches
  after insert or update or delete on public.contact_touches
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_contact_lists on public.contact_lists;
create trigger trg_audit_contact_lists
  after insert or update or delete on public.contact_lists
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_contact_list_members on public.contact_list_members;
create trigger trg_audit_contact_list_members
  after insert or update or delete on public.contact_list_members
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 7. RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.households            enable row level security;
alter table public.contacts              enable row level security;
alter table public.contact_touches       enable row level security;
alter table public.contact_lists         enable row level security;
alter table public.contact_list_members  enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists households_write on public.households;
create policy households_write on public.households for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists contacts_write on public.contacts;
create policy contacts_write on public.contacts for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists contact_touches_select on public.contact_touches;
create policy contact_touches_select on public.contact_touches for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists contact_touches_write on public.contact_touches;
create policy contact_touches_write on public.contact_touches for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists contact_lists_select on public.contact_lists;
create policy contact_lists_select on public.contact_lists for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists contact_lists_write on public.contact_lists;
create policy contact_lists_write on public.contact_lists for all
  using (public.app_is_owner()) with check (public.app_is_owner());

drop policy if exists contact_list_members_select on public.contact_list_members;
create policy contact_list_members_select on public.contact_list_members for select
  using (public.app_is_owner() or public.app_has_module_read('contacts'));
drop policy if exists contact_list_members_write on public.contact_list_members;
create policy contact_list_members_write on public.contact_list_members for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 8. GRANTs
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.households           to authenticated, service_role;
grant select, insert, update, delete on public.contacts             to authenticated, service_role;
grant select, insert, update, delete on public.contact_touches      to authenticated, service_role;
grant select, insert, update, delete on public.contact_lists        to authenticated, service_role;
grant select, insert, update, delete on public.contact_list_members to authenticated, service_role;
grant select on public.households           to anon;
grant select on public.contacts             to anon;
grant select on public.contact_touches      to anon;
grant select on public.contact_lists        to anon;
grant select on public.contact_list_members to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 9. module_registry
-- ───────────────────────────────────────────────────────────────────────────
insert into public.module_registry (slug, label, sort_order)
values ('contacts', 'Contacts', 60)
on conflict (slug) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 10. Seed Christmas cards list (L1)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.contact_lists (name, notes, sort_order)
select 'Christmas cards', 'Seasonal mailing list — membership is households.', 0
where not exists (
  select 1 from public.contact_lists
  where name = 'Christmas cards' and deleted_at is null
);

commit;
