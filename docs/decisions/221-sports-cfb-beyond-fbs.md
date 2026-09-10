# 221 — Sports CFB beyond FBS

**Date:** 2026-09-10
**Module:** sports
**Tracker session:** ad-hoc (missing CFB teams)

## Built

- Root cause: ESPN `/teams?limit=500` returns only the first 500 CFB programs. UTSA (FBS), Ouachita Baptist (D-II), and most NAIA schools live in the remaining ~262 of a 762-team catalog.
- Teams fetch now paginates (`limit=500&page=N`) until a short page.
- CFB scoreboard + standings fetch ESPN groups **80 FBS / 81 FCS / 57 D-II / 58 D-III / 186 NAIA**, merge-deduped by event/team id (FBS vs FCS crossovers share an event).
- CFB scoreboard window is yesterday through +6 days so Thursday `/sports` can show Saturday games. NFL/MLB stay yest–tomorrow.
- `/sports` games query is date-windowed (Chicago −2d…+8d, limit 400); standings cap 1200. Hint copy that CFB includes D-II / NAIA.

## Decided

- **Keep one `college-football` league** — do not split D-II/NAIA into new league slugs. Follow list search is enough.
- **NAIA standings are ESPN-empty** (`group=186` returns 0 entries). Teams still followable; games appear when ESPN publishes them (coverage is sparse vs NCAA).
- Rejected: raising a single `limit=1000` without pagination — ESPN’s catalog can grow; paging is the durable fix.

## Schema changes

- None.

## New components / patterns added

- `CFB_SCOREBOARD_GROUPS` + `dedupeGamesByEventId` in `src/lib/sports/espn.ts`.

## Open questions surfaced

- ESPN NAIA scoreboard is thin (dozens of games, not the full NAIA slate). No second source in v1.

## Surprises (read these before the next session)

- UTSA is FBS and **still** missing from `limit=500` — the default teams list is not “FBS first,” it is a truncated alpha/id catalog (Abilene Christian … Yale on page 1; UTSA + Ouachita on page 2).
- Session 1 `groups=80` was the right Saturday-overflow fix for FBS and the wrong long-term scope (D-II/NAIA never appeared on the scoreboard).
- Default standings (no `group=`) is FBS-only (138, includes UTSA). Ouachita is under `group=57` (D-II) / `group=146` (GAC).

## Carry-forward updates

- [x] components.mdc updated (no new component)
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated
