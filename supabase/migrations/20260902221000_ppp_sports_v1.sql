-- ppp_sports_v1.sql
-- Sports module Session 1 — ESPN sync cache (teams / games / standings).
--
-- Apply: `npm run supabase:db:push` (hosted only).
-- Reuses: set_updated_at, write_audit_log, app_is_owner, app_has_module_read.
--
-- Deliberate deviations from POS_Schema_v1:
--   1. write_audit_log only on sports_teams (games follow toggles). sports_games /
--      sports_standings churn every 10 minutes and would flood audit_log.
--   2. No created_by — rows are written by cron via service_role (auth.uid() is null).
--   3. Full UNIQUE constraints (not partial on deleted_at) so PostgREST onConflict works.

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. sports_teams
-- ───────────────────────────────────────────────────────────────────────────
create table public.sports_teams (
  id            uuid primary key default gen_random_uuid(),
  league        text not null
                  check (league in ('nfl', 'mlb', 'college-football')),
  sport         text not null
                  check (sport in ('football', 'baseball')),
  espn_team_id  text not null,
  display_name  text not null,
  abbreviation  text,
  logo_url      text,
  color         text,
  is_followed   boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (league, espn_team_id)
);

create index sports_teams_followed_idx
  on public.sports_teams (league)
  where is_followed = true and deleted_at is null;

create index sports_teams_league_idx
  on public.sports_teams (league)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. sports_games
-- ───────────────────────────────────────────────────────────────────────────
create table public.sports_games (
  id                 uuid primary key default gen_random_uuid(),
  league             text not null
                       check (league in ('nfl', 'mlb', 'college-football')),
  espn_event_id      text not null,
  start_time         timestamptz not null,
  state              text not null
                       check (state in ('pre', 'in', 'post')),
  status_detail      text,
  period             int,
  display_clock      text,
  home_espn_team_id  text,
  home_name          text,
  home_score         int,
  home_record        text,
  away_espn_team_id  text,
  away_name          text,
  away_score         int,
  away_record        text,
  broadcast          text,
  venue              text,
  synced_at          timestamptz not null default now(),
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (league, espn_event_id)
);

create index sports_games_start_time_idx
  on public.sports_games (start_time desc)
  where deleted_at is null;

create index sports_games_league_state_idx
  on public.sports_games (league, state)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. sports_standings
-- ───────────────────────────────────────────────────────────────────────────
create table public.sports_standings (
  id            uuid primary key default gen_random_uuid(),
  league        text not null
                  check (league in ('nfl', 'mlb', 'college-football')),
  season_year   int not null,
  espn_team_id  text not null,
  team_name     text not null,
  group_name    text,
  wins          int not null default 0,
  losses        int not null default 0,
  ties          int,
  win_percent   numeric,
  games_behind  numeric,
  streak        text,
  rank          int,
  synced_at     timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (league, season_year, espn_team_id)
);

create index sports_standings_league_season_idx
  on public.sports_standings (league, season_year)
  where deleted_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger trg_sports_teams_updated_at
  before update on public.sports_teams
  for each row execute function public.set_updated_at();

create trigger trg_sports_games_updated_at
  before update on public.sports_games
  for each row execute function public.set_updated_at();

create trigger trg_sports_standings_updated_at
  before update on public.sports_standings
  for each row execute function public.set_updated_at();

-- Audit only on teams (follow toggles). Games/standings are high-churn sync caches.
create trigger trg_audit_sports_teams
  after insert or update or delete on public.sports_teams
  for each row execute function public.write_audit_log();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.sports_teams     enable row level security;
alter table public.sports_games     enable row level security;
alter table public.sports_standings enable row level security;

create policy sports_teams_select on public.sports_teams for select
  using (public.app_is_owner() or public.app_has_module_read('sports'));
create policy sports_games_select on public.sports_games for select
  using (public.app_is_owner() or public.app_has_module_read('sports'));
create policy sports_standings_select on public.sports_standings for select
  using (public.app_is_owner() or public.app_has_module_read('sports'));

create policy sports_teams_write on public.sports_teams for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy sports_games_write on public.sports_games for all
  using (public.app_is_owner()) with check (public.app_is_owner());
create policy sports_standings_write on public.sports_standings for all
  using (public.app_is_owner()) with check (public.app_is_owner());

-- ───────────────────────────────────────────────────────────────────────────
-- 6. GRANTs
-- ───────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.sports_teams     to authenticated, service_role;
grant select, insert, update, delete on public.sports_games     to authenticated, service_role;
grant select, insert, update, delete on public.sports_standings to authenticated, service_role;
grant select on public.sports_teams     to anon;
grant select on public.sports_games     to anon;
grant select on public.sports_standings to anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. module_registry
-- ───────────────────────────────────────────────────────────────────────────
insert into public.module_registry (slug, label, sort_order)
values ('sports', 'Sports', 55)
on conflict (slug) do nothing;

commit;
