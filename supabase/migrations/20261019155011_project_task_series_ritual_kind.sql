-- Link a MYN recurring series to an in-app ritual (v1: weekly project check-in).
-- Completing the ritual in-app auto-completes the matching open occurrence.

alter table public.project_task_series
  add column if not exists ritual_kind text;

alter table public.project_task_series
  drop constraint if exists project_task_series_ritual_kind_check;

alter table public.project_task_series
  add constraint project_task_series_ritual_kind_check
  check (ritual_kind is null or ritual_kind in ('weekly_project_checkin'));

-- At most one live series per ritual kind.
create unique index if not exists project_task_series_ritual_kind_live_uidx
  on public.project_task_series (ritual_kind)
  where ritual_kind is not null and deleted_at is null;

comment on column public.project_task_series.ritual_kind is
  'Optional in-app ritual this series represents. weekly_project_checkin auto-completes when countMissingWeekCheckIns is 0.';

-- Backfill the existing Weekly Status series (Monday Opportunity Now).
update public.project_task_series
set ritual_kind = 'weekly_project_checkin'
where id = '3a661f84-d575-4cbf-bfd1-57ee3a15bb44'
  and deleted_at is null
  and ritual_kind is null;
