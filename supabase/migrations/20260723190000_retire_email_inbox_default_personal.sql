-- Retire Email Inbox: inbound email → Personal; soft-delete Email Inbox project.
-- Personal root UUID is looked up by name (seed domains). Email Inbox keeps fixed UUID.

begin;

-- 1. Move live Email Inbox tasks to Personal
update public.project_tasks t
set project_id = p.id
from public.projects p
where p.name = 'Personal'
  and p.parent_id is null
  and p.deleted_at is null
  and t.project_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
  and t.deleted_at is null;

-- 2. Soft-delete Email Inbox (if still live)
update public.projects
set deleted_at = now()
where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
  and deleted_at is null;

-- 3. Owner default New Task project → Personal
update public.profiles pr
set default_task_project_id = p.id
from public.projects p
where p.name = 'Personal'
  and p.parent_id is null
  and p.deleted_at is null
  and pr.role = 'owner'
  and pr.deleted_at is null;

commit;
