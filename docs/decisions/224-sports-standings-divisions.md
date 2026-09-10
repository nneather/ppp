# 224 — Sports standings: divisions, W-L, rank

**Date:** 2026-09-10
**Module:** sports
**Tracker session:** ad-hoc (broken `/sports` standings)

## Built

- ESPN’s default standings payload is **conference-only** (AFC/NFC 16-team lists; AL/NL 15-team wild-card order). Fetch now always passes `level=3` so NFL is eight divisions and MLB is six.
- CFB stats arrays concatenate overall + Home + Away + vs Conf under the same `name`. Last-write-wins turned Alabama 1-0 into 0-0. Parser keeps the first overall block (skip `type` values with `_`) and still parses W-L from `overall` when `losses` is missing.
- Followed standings/games are keyed by `league + espn_team_id`. ESPN reuses ids across NFL/MLB/CFB (Colts = Athletics = Colorado Mesa = `11`), so the All tab was showing Chargers/Cowboys/Mesa tables Parker does not follow.
- Table rank is 1-based order after W-L sort (not ESPN `playoffSeed`, which is 0 for most NFL/CFB rows). GB column added. Seed `0` and streak `-` store as null.

## Decided

- **Always `level=3`** on `/standings` — including CFB `group=80/81/57/58/186`. Harmless where ESPN already returns conference leaves (SEC); required for NFL/MLB.
- **Do not import `espn.ts` from the sports page** — fetch lives there. Group/sort helpers live in client-safe `src/lib/sports/standings.ts`.
- Rejected: storing ESPN playoff seed as the `#` column. Conference seed ≠ division rank.

## Schema changes

- None.

## New components / patterns added

- `src/lib/sports/standings.ts` — `compareStandingRows` / `groupStandings`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `site.web.api` `/standings?season=2026` has **no division children**. `level=3` is the documented-in-the-wild switch; `site.api` still 403s.
- CFB has **no `losses` stat** in the overall block — only `wins` + `overall` display `"1-0"`. The 221 overall-parse fallback was right and still lost because `wins` was overwritten later in the same array.

## Carry-forward updates

- [x] components.mdc updated (no new Svelte component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated
