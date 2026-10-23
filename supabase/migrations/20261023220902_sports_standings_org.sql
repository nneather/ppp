-- Standings dropdowns need the parent ESPN currently discards.
-- subdivision: CFB bucket from the fetch group id (fbs/fcs/d2/d3/naia). Null for NFL/MLB.
-- conference: path segment above the leaf when the tree is three or more names deep;
-- otherwise the leaf itself (a conference that is the table).

alter table public.sports_standings
  add column if not exists subdivision text,
  add column if not exists conference text;

alter table public.sports_standings
  drop constraint if exists sports_standings_subdivision_check;

alter table public.sports_standings
  add constraint sports_standings_subdivision_check
  check (
    subdivision is null
    or subdivision in ('fbs', 'fcs', 'd2', 'd3', 'naia')
  );
