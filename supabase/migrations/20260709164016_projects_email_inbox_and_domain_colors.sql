-- Domain color keys on projects + email-to-task capture fields on project_tasks.
-- Seeds a fixed-UUID "Email Inbox" child under the Work root for Resend inbound.
-- Apply via `npm run supabase:db:push` (hosted only).

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. projects.color — palette key (e.g. 'ocean'); validated in app code
-- ───────────────────────────────────────────────────────────────────────────
alter table public.projects
  add column if not exists color text;

comment on column public.projects.color is
  'Optional domain color palette key (e.g. ocean). Meaningful for root domains; validated in app.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. project_tasks.notes + source_email_id (inbound idempotency)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.project_tasks
  add column if not exists notes text;

alter table public.project_tasks
  add column if not exists source_email_id text;

comment on column public.project_tasks.notes is
  'Optional longer body (e.g. forwarded email plain text).';

comment on column public.project_tasks.source_email_id is
  'Resend inbound email_id when created via email-inbound-task; used for webhook idempotency.';

create unique index if not exists project_tasks_source_email_id_uidx
  on public.project_tasks (source_email_id)
  where source_email_id is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Seed Email Inbox under Work (fixed UUID for Edge Function secret)
-- ───────────────────────────────────────────────────────────────────────────
-- UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
insert into public.projects (
  id,
  parent_id,
  name,
  description,
  lifecycle_status,
  sort_order,
  created_by
)
select
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  work.id,
  'Email Inbox',
  'Tasks created by forwarding email to tasks@in.npneathery.com. Re-file into the right project.',
  'active',
  0,
  owner.id
from (
  select id
  from public.projects
  where name = 'Work'
    and parent_id is null
    and deleted_at is null
  order by created_at
  limit 1
) as work
cross join (
  select id
  from public.profiles
  where role = 'owner'
  order by created_at
  limit 1
) as owner
where not exists (
  select 1
  from public.projects
  where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
);

commit;
