-- Venue logistics for preaching trips: when the service starts, how long the
-- drive is, when to leave, and which hymnal the church uses.
-- Leave-by is stored rather than computed — the cushion past drive time is not
-- uniform (Mt. Zion 20 min, Grandcoate 25, Marissa 20).

begin;

alter table public.sermon_venues
  add column if not exists service_start time,
  add column if not exists drive_minutes smallint,
  add column if not exists depart_by time,
  add column if not exists hymnal text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sermon_venues_drive_minutes_check'
      and conrelid = 'public.sermon_venues'::regclass
  ) then
    alter table public.sermon_venues
      add constraint sermon_venues_drive_minutes_check
      check (drive_minutes is null or (drive_minutes >= 1 and drive_minutes <= 600));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sermon_venues_hymnal_check'
      and conrelid = 'public.sermon_venues'::regclass
  ) then
    alter table public.sermon_venues
      add constraint sermon_venues_hymnal_check
      check (
        hymnal is null
        or hymnal in ('trinity', 'celebration', 'worship_and_celebration')
      );
  end if;
end $$;

-- Initial fill. coalesce so a re-apply does not clobber a later edit.
update public.sermon_venues
set
  service_start = coalesce(service_start, time '09:30'),
  drive_minutes = coalesce(drive_minutes, 55),
  depart_by = coalesce(depart_by, time '08:15'),
  hymnal = coalesce(hymnal, 'trinity'),
  notes = coalesce(
    notes,
    'Larry sends the bulletin no questions asked Saturday (often evening).'
  )
where deleted_at is null
  and lower(trim(name)) = 'mt. zion presbyterian';

update public.sermon_venues
set
  service_start = coalesce(service_start, time '11:00'),
  drive_minutes = coalesce(drive_minutes, 75),
  depart_by = coalesce(depart_by, time '09:20'),
  hymnal = coalesce(hymnal, 'trinity'),
  notes = coalesce(
    notes,
    'Donna gets anxious if she hasn''t heard by Thursday but doesn''t need it until EOD Thursday.'
  )
where deleted_at is null
  and lower(trim(name)) = 'grandcoate presbyterian';

update public.sermon_venues
set
  service_start = coalesce(service_start, time '10:30'),
  drive_minutes = coalesce(drive_minutes, 60),
  depart_by = coalesce(depart_by, time '09:10'),
  hymnal = coalesce(hymnal, 'celebration'),
  notes = coalesce(
    notes,
    'Larry checks in if he hasn''t heard by Wednesday but doesn''t need it until Thursday night.'
  )
where deleted_at is null
  and lower(trim(name)) = 'marissa presbyterian';

update public.sermon_venues
set service_start = coalesce(service_start, time '10:30')
where deleted_at is null
  and lower(trim(name)) = 'res pres madison';

commit;
