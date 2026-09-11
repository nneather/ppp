# 227 — Sports GHA sync crashed on `dotenv`

**Date:** 2026-09-11
**Module:** sports
**Tracker session:** ad-hoc (GHA ESPN job red)

## Built

- GitHub Actions `Sports ESPN sync` failed every scheduled run since it landed (7 in a row, ~11s each). ESPN was never called.
- Root cause: `.github/workflows/sports-sync.yml` runs `npx tsx scripts/sports-sync.ts` with **no `npm ci`**. The script had a top-level `import { config } from 'dotenv'`. GHA has no `node_modules`, so Node threw `ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'`.
- Removed the `dotenv` import. Local `npm run sports:sync` already wraps with `dotenv-cli`. GHA already injects `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as secrets. Workflow comment now says the script must stay package-free.

## Decided

- **Keep no-`npm ci` on the 10m ticker.** Installing the app lockfile every 10 minutes is slower and was the point of `npx tsx`. The CLI must not import npm packages — relative `src/lib/sports/espn.ts` only.
- Rejected: `npx -p tsx -p dotenv` or a try/catch dynamic import. Local env load already lives on the npm script.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- After this lands on `main`, dispatch the workflow once (with standings) to refill scores that went stale overnight.

## Surprises (read these before the next session)

- Local `npx tsx scripts/sports-sync.ts` still resolves `dotenv` from the repo `node_modules`, so this never reproduced on a laptop. GHA checkout is a bare tree.
- Failure mode looks like “ESPN is down” in the Actions list; logs die before the first fetch.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md inventory — GHA package-free constraint
- [x] new env vars — none
- [x] tracker Open Questions — note GHA was red until 227
