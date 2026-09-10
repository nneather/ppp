# 220 — Sports sync via GitHub Actions

**Date:** 2026-09-10
**Module:** sports
**Tracker session:** ad-hoc (sync never wrote)

## Built

- Root cause: `sports_teams` / `sports_games` / `sports_standings` were empty since Session 1. ESPN fetch works; the writer never ran in prod.
- Hobby Vercel rejected the `*/10` scores cron (blocked the Sep 3 deploy until it was dropped on Sep 4). The leftover daily job (`/api/sports/sync?standings=1`) 401s because `CRON_SECRET` was never set in Vercel — owner smoke was still unchecked.
- CLI `npm run sports:sync -- --standings` populated the hosted cache (NFL/MLB/CFB games, teams, standings).
- GitHub Actions `.github/workflows/sports-sync.yml`: scores every 10m, standings at 14:05 UTC; `npx tsx` + PostgREST (no `npm ci`). Secrets `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Owner **Refresh scores** on `/sports` (`syncNowAction`, owner RLS writes, includes standings). Last-synced stamp. `GET /api/sports/sync` also accepts an owner session.
- ESPN host order: `site.web.api` first (`site.api` 403s).

## Decided

- **GHA is the score ticker on Hobby** — not Vercel `*/10`. Daily Vercel cron stays as a backup if `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` are later set on the project; it is not required for the cache to stay fresh.
- **GHA writes PostgREST directly** (service role) instead of curling the Vercel route, so sync does not depend on Hobby's 10s limit or Vercel env.
- **Owner refresh uses the user JWT** (owner write policies), not service role, so it works on Vercel today without new env vars.

## Schema changes

- None.

## New components / patterns added

- `scripts/sports-sync.ts` — CLI/GHA ESPN → PostgREST upsert (relative imports; no `$lib`).
- `.github/workflows/sports-sync.yml` — scheduled sports cache refresh.

## Open questions surfaced

- Optional: set `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel if we want the daily Hobby cron as a second path.
- Upgrade to Pro if we ever want Vercel-native 10m crons again.

## Surprises (read these before the next session)

- Prod had **zero** sports rows for a week; `/sports` empty state looked like “sync broken” because it was — cron never authorized.
- `dotenv-cli` printed 0 keys from `.env` in this environment; the script’s own `dotenv` load of `.env` still supplied `SUPABASE_SERVICE_ROLE_KEY`.
- CFB `/teams?limit=500` upserts 500 rows; standings leaf walk yielded 138.

## Carry-forward updates

- [x] components.mdc updated (no new component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (GHA secrets `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [x] tracker Open Questions updated
