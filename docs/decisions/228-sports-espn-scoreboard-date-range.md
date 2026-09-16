# 228 — Sports ESPN scoreboard date-range 400

**Date:** 2026-09-16
**Module:** sports
**Tracker session:** ad-hoc (GHA ESPN job red)

## Built

- GitHub Actions `Sports ESPN sync` failed every scheduled run from 2026-09-15 22:57 UTC through this session (7+ in a row). Payload: `"ESPN 400 from https://site.api.espn.com"` for NFL, MLB, and CFB. ESPN was reached; upserts never ran.
- Root cause: `scoreboardDatesParam` sent `dates=YYYYMMDD-YYYYMMDD`. ESPN `site.web.api` now returns **400** `{"code":400,"message":"Failed to get events endpoint."}` for hyphenated ranges. Single-day `dates=YYYYMMDD` and no `dates` still 200. `site.api.espn.com` is Akamai 403 (or 400 on GHA), so the fallback never saved us.
- Scoreboard fetch now expands the same Chicago window to a civil-day list and requests **one YYYYMMDD per call**, merging/deduping events. CFB still fans out groups per day. `scoreboardDatesParam` stays as the log window string only.
- ESPN error messages now include a truncated response body so the next 400 is readable in Actions.

## Decided

- **Per-day scoreboard, not a different host.** `cdn.espn.com/core/.../scoreboard?xhr=1` 200s but is a different payload; keep site.web.api + normalizeScoreboard.
- **Do not send ranges with a fallback.** Range 400s every 10 minutes is wasted work. Query string is a single day from now on.
- Rejected: `seasontype`/`week` instead of dates — that is current-week only and would drop yesterday/tomorrow MLB and the CFB Saturday window.

## Schema changes

- None.

## New components / patterns added

- `scoreboardDateList` / `scoreboardQueryString` in `src/lib/sports/espn.ts`.

## Open questions surfaced

- After this lands on `main`, dispatch the workflow once (scores only is enough) to refill games that went stale overnight.

## Surprises (read these before the next session)

- Last green run was 2026-09-15 20:14 UTC; ESPN likely dropped range support that evening. Failure mode looks like “ESPN is down”; it is a query-string 400.
- Comma-separated dates and ISO `2026-09-15-2026-09-17` also 400. Week param works for NFL but is the wrong window for this cache.
- Local `site.api` 403 vs GHA last-error `site.api` 400 — same range bug; host order just changes which status gets logged.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — per-day scoreboard `dates=`
- [x] new env vars — none
- [x] tracker Open Questions — note 228
