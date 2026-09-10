# POS Sports — Build Tracker

Module slug: `sports` · Route: `/sports` · Session 0: inline in [218](../decisions/218-sports-session-1.md) (deviations from POS_Schema locked there).

## Sessions

### Session 1 — Scoreboard scaffold ✅

**Goal:** Cron-synced NFL / MLB / CFB scoreboard with follow toggles + dashboard glance.

**Acceptance**

- [x] Migration applied (`sports_teams` / `sports_games` / `sports_standings`); audit only on teams; full uniques; RLS + GRANTs + `module_registry`
- [x] ESPN fetch/normalize + unit tests; service-role admin client; `GET /api/sports/sync` with `CRON_SECRET`
- [x] `/sports` list + follow toggle; dashboard glance; desktop nav; CSP espncdn; permissions + audit whitelist
- [x] `vercel.json` crons; env docs; decision 218; PLAN / AGENTS / components / POS_Schema
- [x] Cache populated 2026-09-10 via `npm run sports:sync -- --standings` ([220](../decisions/220-sports-sync-github-actions.md))
- [ ] Owner smoke: follow 2–3 teams, confirm `/sports` + dashboard glance
- [ ] Viewer without `sports` permission sees empty/graceful UI (not 403)

**Notes:** See [218](../decisions/218-sports-session-1.md) + [220](../decisions/220-sports-sync-github-actions.md) + [221](../decisions/221-sports-cfb-beyond-fbs.md). Hobby cannot run `*/10`; GHA is the ticker. CFB follow list is the full ESPN catalog (paginate past 500).

## Open questions

- ~~Confirm Vercel plan (Pro vs Hobby) before relying on `*/10` cron.~~ **Hobby** — confirmed Sep 4 (deploy failed until 10m cron dropped). GHA owns the 10m path.
- Optional later: NBA/NHL, push notifications, MCP `list_followed_scores`.
- Optional: set `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel for the daily backup cron.
- ESPN NAIA scoreboard is sparse; no second source.

## Out of scope (v1)

- Entity create/edit sheets for games/teams
- Soft-delete of sync rows from the UI
- MCP tools
