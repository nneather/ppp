-- A due date is the day a copy should come back. One reminder per person
-- lists every book they still have, a lead time before the soonest due date.

alter table public.book_loans
  add column if not exists due_on date;

update public.book_loans
set due_on = checked_out_on + interval_days
where due_on is null;

alter table public.book_loans
  alter column due_on set not null;

alter table public.profiles
  add column if not exists loan_due_days int not null default 30;

alter table public.profiles
  add column if not exists loan_reminder_lead_days int not null default 7;

alter table public.profiles
  drop constraint if exists profiles_loan_due_days_range;

alter table public.profiles
  add constraint profiles_loan_due_days_range check (loan_due_days between 1 and 366);

alter table public.profiles
  drop constraint if exists profiles_loan_reminder_lead_days_range;

alter table public.profiles
  add constraint profiles_loan_reminder_lead_days_range check (loan_reminder_lead_days between 0 and 60);

alter table public.book_loan_messages
  add column if not exists contact_id uuid references public.contacts(id);

update public.book_loan_messages m
set contact_id = l.contact_id
from public.book_loans l
where m.loan_id = l.id
  and m.contact_id is null;

alter table public.book_loan_messages
  alter column contact_id set not null;

alter table public.book_loan_messages
  alter column loan_id drop not null;

create index if not exists book_loan_messages_contact_idx
  on public.book_loan_messages (contact_id)
  where deleted_at is null;

drop index if exists public.book_loan_messages_one_open_reminder_idx;

with ranked as (
  select
    id,
    row_number() over (
      partition by contact_id
      order by scheduled_for, created_at
    ) as rn
  from public.book_loan_messages
  where deleted_at is null
    and kind = 'reminder'
    and status in ('queued', 'sending', 'failed')
)
update public.book_loan_messages m
set status = 'cancelled'
from ranked r
where m.id = r.id
  and r.rn > 1;

create unique index if not exists book_loan_messages_one_open_reminder_contact_idx
  on public.book_loan_messages (contact_id)
  where deleted_at is null
    and kind = 'reminder'
    and status in ('queued', 'sending', 'failed');

update public.email_templates
set html_body = $html$<p>Hi {{contact.first_name}},</p><p>I checked this out to you on {{loan.checked_out_on}}. Enjoy it, and send it back by {{loan.due_on}}.</p>{{loan.books}}<p>{{owner.first_name}}</p>$html$
where id = 'c1a01100-0000-4000-8000-000000000002'
  and deleted_at is null
  and html_body = $html$<p>Hi {{contact.first_name}},</p><p>I checked <em>{{book.title}}</em> out to you on {{loan.checked_out_on}}. Enjoy it, and send it back when you are done.</p><p>{{owner.first_name}}</p>$html$;

update public.email_templates
set html_body = $html$<p>Hi {{contact.first_name}},</p><p>A reminder about what you still have. The soonest due date is {{loan.due_on}}.</p>{{loan.books}}<p>{{owner.first_name}}</p>$html$
where id = 'c1a01100-0000-4000-8000-000000000003'
  and deleted_at is null
  and html_body = $html$<p>Hi {{contact.first_name}},</p><p>A reminder that you have <em>{{book.title}}</em>, checked out on {{loan.checked_out_on}} ({{loan.days_out}} days ago). Please send it back by {{loan.due_on}}.</p><p>{{owner.first_name}}</p>$html$;
