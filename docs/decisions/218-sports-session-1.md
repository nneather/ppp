# 218 — Sports scoreboard Session 1

**Date:** 2026-09-02
**Module:** sports
**Tracker session:** Session 1

## Built

- Schema: `sports_teams` / `sports_games` / `sports_standings` with RLS (`app_is_owner` / `app_has_module_read('sports')`), owner-only writes, `module_registry` slug `sports`.
- ESPN sync cache: `src/lib/sports/espn.ts` (site.api → site.web.api fallback, defensive normalize) + `src/lib/sports/server/sync.ts` upserts via service-role client.
- Cron endpoint: `GET /api/sports/sync` (`Authorization: Bearer $CRON_SECRET`); `?standings=1` refreshes teams + standings without clobbering `is_followed`.
- `/sports` scoreboard (live / upcoming / final), standings by group, searchable follow list (owner). Default filter = followed teams; if none followed, show NFL+MLB and hide CFB wall.
- Dashboard glance for yesterday/today followed-team games (else next upcoming).
- Desktop sidebar nav after Sermons (no 6th mobile tab). CSP `img-src` allows `https://a.espncdn.com`.
- Permissions slug `sports`; audit UI whitelist `_SPORTS_TABLES = ['sports_teams']` only.
- `vercel.json` crons: scores every 10m; standings daily `0 14 * * *` UTC (~9am Chicago CDT).

## Decided

- **Audit only on `sports_teams`** — games/standings are high-churn sync caches; would flood `audit_log`. Documented POS_Schema exception.
- **No entity CRUD sheets** — only mutation is `is_followed` toggle (owner).
- **No `created_by`** — cron/service_role has null `auth.uid()` (kickoff footgun).
- **Full UNIQUE** (not partial on `deleted_at`) so PostgREST `onConflict` works; sync upserts, never soft-deletes.
- **Always pass ESPN `season=`** — MLB omit jumps to the wrong year; NFL/CFB month≥8, MLB month≥3.
- **CFB scoreboard `groups=80` (FBS)** — `limit=200` alone is too tight on Saturdays.
- **Leagues v1:** `nfl` | `mlb` | `college-football` only (not NBA/NHL).
- **No MCP tool in v1.**

## Schema changes

- `supabase/migrations/20260902221000_ppp_sports_v1.sql` — teams/games/standings + RLS + GRANTs + module_registry.

## New components / patterns added

- `src/lib/sports/espn.ts` — fetch + normalize (unit-tested).
- `src/lib/sports/server/{sync,loaders,actions}.ts` — cron upserts, page loaders, follow toggle.
- `src/lib/supabase/admin.ts` — first SvelteKit service-role client (cron only).
- `src/lib/components/dashboard-sports-glance.svelte` — dashboard followed-team glance.
- `src/routes/sports/` — list + follow UI.
- `src/routes/api/sports/sync/` — cron entrypoint.

## Open questions surfaced

- **Vercel Hobby** only allows daily crons — if this project is Hobby, move the `*/10` scores cron to GitHub Actions. Confirm on ship.
- Confirm `CRON_SECRET` is set in Vercel (auto-injected as Bearer on cron requests when present).

## Surprises (read these before the next session)

- `site.api.espn.com` often 403s; `site.web.api.espn.com` with a UA works.
- Standings rank is always `playoffSeed`, never `rank`. CFB may lack `losses` — parse from `overall` display.
- Rank/GB `displayValue` of `"-"` must store as null.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (`CRON_SECRET`)
- [x] tracker Open Questions updated
