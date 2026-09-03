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
- [ ] Owner smoke: set `CRON_SECRET`, hit sync locally, follow 2–3 teams, confirm `/sports` + dashboard
- [ ] Viewer without `sports` permission sees empty/graceful UI (not 403)

**Notes:** See [218](../decisions/218-sports-session-1.md). Hobby plan may block sub-daily crons.

## Open questions

- Confirm Vercel plan (Pro vs Hobby) before relying on `*/10` cron.
- Optional later: NBA/NHL, push notifications, MCP `list_followed_scores`.

## Out of scope (v1)

- Entity create/edit sheets for games/teams
- Soft-delete of sync rows from the UI
- MCP tools
