-- Venues carry a default occasion type (C/P/A) so the sermon form can auto-fill
-- context when a location is selected. Reverses Session 0 "venues have no type"
-- ([090]) now that every live venue is type-homogeneous.

begin;

alter table public.sermon_venues
  add column if not exists context_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sermon_venues_context_type_check'
      and conrelid = 'public.sermon_venues'::regclass
  ) then
    alter table public.sermon_venues
      add constraint sermon_venues_context_type_check
      check (context_type is null or context_type in ('church', 'parachurch', 'academic'));
  end if;
end $$;

-- Majority live-sermon context per venue (ties broken by enum name). Current
-- prod rows are homogeneous, so this is a straight copy.
with ranked as (
  select
    venue_id,
    context_type,
    row_number() over (
      partition by venue_id
      order by count(*) desc, context_type
    ) as rn
  from public.sermons
  where deleted_at is null
    and venue_id is not null
    and context_type is not null
  group by venue_id, context_type
)
update public.sermon_venues v
set context_type = ranked.context_type
from ranked
where v.id = ranked.venue_id
  and ranked.rn = 1
  and v.context_type is null;

commit;
