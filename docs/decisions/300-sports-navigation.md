# 300 — Sports navigation

**Date:** 2026-10-23
**Module:** sports
**Tracker session:** ad-hoc

## Built

- `/sports` is Scores | Standings | Teams (`?view=`). League chips stay.
- Scores stay limited to followed teams (NFL + MLB when nobody is followed). Live games stay pinned. The rest are grouped by Chicago day.
- Standings show one table. NFL is Conference (AFC / NFC) then Division. MLB is League (AL / NL) then Division. College football is Subdivision (FBS, FCS, Division II, Division III, NAIA) then Conference, plus Division only when a conference splits (Northern Sun, PSAC).
- Teams use the same dropdowns. An empty search stays inside the selection. Typing searches the whole selected league, which is how an NAIA school is found (ESPN publishes no NAIA standings).
- Dropdown changes use `replaceState`. The view switch and league chips use `goto`. Each view loads only what it renders.

## Decided

- Store `subdivision` from the CFB fetch group id (`80` / `81` / `57` / `58` / `186`), not the root label (`FBS` vs `NCAA Division II`). `conference` is the path segment above the leaf when the tree is three or more names; otherwise the leaf. `group_name` stays the table title.
- Until those columns are filled, standings fall back to one dropdown of leaf names. Owner Refresh scores and `npm run sports:sync -- --standings` write them. The 9:05am Chicago job does too.
- Scores do not get a day dropdown. A followed slate is short; day headings are enough.

## Schema changes

- `20261023220902_sports_standings_org.sql` — `sports_standings.subdivision` and `conference`.

## New components / patterns added

- `src/lib/components/sports-view-toggle.svelte`
- `src/lib/components/sports-org-selects.svelte`
- `src/lib/components/sports-score-list.svelte`
- `src/lib/components/sports-standings-table.svelte`
- `src/lib/components/sports-team-list.svelte`
- `resolveSportsOrg` / `filterTeamsForOrg` in `src/lib/sports/standings.ts`

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- ESPN’s teams endpoint ignores `groups=`, and team records have no conference. The team dropdowns join standings. Schools with no standings row (NAIA) only show up in search.
- D-II is the only college bucket whose leaves are divisions (`Northern Sun - North`). FBS and FCS conferences are the table.
- `scripts/sports-sync.ts` upserts standings on its own. It has to send `subdivision` and `conference` or the daily job would leave the columns null.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars — none
- [x] tracker note updated
