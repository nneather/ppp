-- Library checkout loans plus a shared email-template store.
-- Loans are one physical copy per row. Queued messages keep their own HTML
-- so editing a reminder does not change the standing template.

create table if not exists public.email_template_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  constraint email_template_folders_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists email_template_folders_sort_idx
  on public.email_template_folders (sort_order, name)
  where deleted_at is null;

drop trigger if exists trg_email_template_folders_updated_at on public.email_template_folders;
create trigger trg_email_template_folders_updated_at
  before update on public.email_template_folders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_email_template_folders on public.email_template_folders;
create trigger trg_audit_email_template_folders
  after insert or update or delete on public.email_template_folders
  for each row execute function public.write_audit_log();

alter table public.email_template_folders enable row level security;

drop policy if exists email_template_folders_owner on public.email_template_folders;
create policy email_template_folders_owner on public.email_template_folders
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.email_template_folders to authenticated, service_role;
grant select on public.email_template_folders to anon;

create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid references public.email_template_folders(id),
  name        text not null,
  subject     text not null default '',
  html_body   text not null default '',
  is_active   boolean not null default true,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  constraint email_templates_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists email_templates_folder_idx
  on public.email_templates (folder_id)
  where deleted_at is null;

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_email_templates on public.email_templates;
create trigger trg_audit_email_templates
  after insert or update or delete on public.email_templates
  for each row execute function public.write_audit_log();

alter table public.email_templates enable row level security;

drop policy if exists email_templates_owner on public.email_templates;
create policy email_templates_owner on public.email_templates
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.email_templates to authenticated, service_role;
grant select on public.email_templates to anon;

create table if not exists public.email_template_bindings (
  id           uuid primary key default gen_random_uuid(),
  binding_key  text not null,
  template_id  uuid not null references public.email_templates(id),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  constraint email_template_bindings_key_not_blank check (length(btrim(binding_key)) > 0)
);

create unique index if not exists email_template_bindings_key_live_idx
  on public.email_template_bindings (binding_key)
  where deleted_at is null;

drop trigger if exists trg_email_template_bindings_updated_at on public.email_template_bindings;
create trigger trg_email_template_bindings_updated_at
  before update on public.email_template_bindings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_email_template_bindings on public.email_template_bindings;
create trigger trg_audit_email_template_bindings
  after insert or update or delete on public.email_template_bindings
  for each row execute function public.write_audit_log();

alter table public.email_template_bindings enable row level security;

drop policy if exists email_template_bindings_owner on public.email_template_bindings;
create policy email_template_bindings_owner on public.email_template_bindings
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.email_template_bindings to authenticated, service_role;
grant select on public.email_template_bindings to anon;

create table if not exists public.book_loans (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books(id),
  contact_id       uuid not null references public.contacts(id),
  recipient_name   text not null,
  recipient_email  text not null,
  checked_out_on   date not null,
  returned_at      timestamptz,
  interval_days    int not null default 30,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles(id),
  constraint book_loans_interval_range check (interval_days between 1 and 366),
  constraint book_loans_email_shape check (
    recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint book_loans_name_not_blank check (length(btrim(recipient_name)) > 0)
);

create index if not exists book_loans_open_book_idx
  on public.book_loans (book_id)
  where deleted_at is null and returned_at is null;

create index if not exists book_loans_open_contact_idx
  on public.book_loans (contact_id)
  where deleted_at is null and returned_at is null;

create index if not exists book_loans_open_checked_out_idx
  on public.book_loans (checked_out_on)
  where deleted_at is null and returned_at is null;

drop trigger if exists trg_book_loans_updated_at on public.book_loans;
create trigger trg_book_loans_updated_at
  before update on public.book_loans
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_book_loans on public.book_loans;
create trigger trg_audit_book_loans
  after insert or update or delete on public.book_loans
  for each row execute function public.write_audit_log();

alter table public.book_loans enable row level security;

drop policy if exists book_loans_select on public.book_loans;
create policy book_loans_select on public.book_loans
  for select
  using (public.app_is_owner() or public.app_has_module_read('library'));

drop policy if exists book_loans_insert on public.book_loans;
create policy book_loans_insert on public.book_loans
  for insert
  with check (public.app_is_owner());

drop policy if exists book_loans_update on public.book_loans;
create policy book_loans_update on public.book_loans
  for update
  using (public.app_is_owner())
  with check (public.app_is_owner());

drop policy if exists book_loans_delete on public.book_loans;
create policy book_loans_delete on public.book_loans
  for delete
  using (public.app_is_owner());

grant select, insert, update, delete on public.book_loans to authenticated, service_role;
grant select on public.book_loans to anon;

create table if not exists public.book_loan_messages (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references public.book_loans(id),
  kind           text not null,
  template_id    uuid references public.email_templates(id),
  subject        text not null,
  html_body      text not null,
  scheduled_for  date not null,
  status         text not null,
  sent_at        timestamptz,
  provider_id    text,
  error          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  constraint book_loan_messages_kind_check check (kind in ('checkout', 'reminder')),
  constraint book_loan_messages_status_check check (
    status in ('queued', 'sending', 'sent', 'failed', 'cancelled')
  )
);

create index if not exists book_loan_messages_due_idx
  on public.book_loan_messages (scheduled_for)
  where deleted_at is null and status = 'queued';

create index if not exists book_loan_messages_loan_idx
  on public.book_loan_messages (loan_id)
  where deleted_at is null;

drop trigger if exists trg_book_loan_messages_updated_at on public.book_loan_messages;
create trigger trg_book_loan_messages_updated_at
  before update on public.book_loan_messages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_book_loan_messages on public.book_loan_messages;
create trigger trg_audit_book_loan_messages
  after insert or update or delete on public.book_loan_messages
  for each row execute function public.write_audit_log();

alter table public.book_loan_messages enable row level security;

drop policy if exists book_loan_messages_owner on public.book_loan_messages;
create policy book_loan_messages_owner on public.book_loan_messages
  for all
  using (public.app_is_owner())
  with check (public.app_is_owner());

grant select, insert, update, delete on public.book_loan_messages to authenticated, service_role;
grant select on public.book_loan_messages to anon;

-- Seed the Library folder and the two loan templates. Fixed ids keep re-runs stable.
insert into public.email_template_folders (id, name, sort_order)
select 'c1a01100-0000-4000-8000-000000000001', 'Library', 0
where not exists (
  select 1 from public.email_template_folders
  where id = 'c1a01100-0000-4000-8000-000000000001'
);

insert into public.email_templates (id, folder_id, name, subject, html_body)
select
  'c1a01100-0000-4000-8000-000000000002',
  'c1a01100-0000-4000-8000-000000000001',
  'Book checkout',
  'I lent you {{book.title}}',
  $html$<p>Hi {{contact.first_name}},</p><p>I checked <em>{{book.title}}</em> out to you on {{loan.checked_out_on}}. Enjoy it, and send it back when you are done.</p><p>{{owner.first_name}}</p>$html$
where not exists (
  select 1 from public.email_templates
  where id = 'c1a01100-0000-4000-8000-000000000002'
);

insert into public.email_templates (id, folder_id, name, subject, html_body)
select
  'c1a01100-0000-4000-8000-000000000003',
  'c1a01100-0000-4000-8000-000000000001',
  'Book reminder',
  'Still have {{book.title}}?',
  $html$<p>Hi {{contact.first_name}},</p><p>A reminder that you have <em>{{book.title}}</em>, checked out on {{loan.checked_out_on}} ({{loan.days_out}} days ago). Let me know when I can pick it up.</p><p>{{owner.first_name}}</p>$html$
where not exists (
  select 1 from public.email_templates
  where id = 'c1a01100-0000-4000-8000-000000000003'
);

insert into public.email_template_bindings (id, binding_key, template_id)
select
  'c1a01100-0000-4000-8000-000000000004',
  'library.loan.checkout',
  'c1a01100-0000-4000-8000-000000000002'
where not exists (
  select 1 from public.email_template_bindings
  where binding_key = 'library.loan.checkout' and deleted_at is null
);

insert into public.email_template_bindings (id, binding_key, template_id)
select
  'c1a01100-0000-4000-8000-000000000005',
  'library.loan.reminder',
  'c1a01100-0000-4000-8000-000000000003'
where not exists (
  select 1 from public.email_template_bindings
  where binding_key = 'library.loan.reminder' and deleted_at is null
);
