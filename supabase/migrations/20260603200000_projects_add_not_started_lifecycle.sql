-- Add not_started lifecycle status to projects (Session 2 filter UX).
begin;

alter table public.projects drop constraint if exists projects_lifecycle_status_check;
alter table public.projects add constraint projects_lifecycle_status_check
  check (lifecycle_status in ('not_started','idea','active','paused','done','archived'));

commit;
