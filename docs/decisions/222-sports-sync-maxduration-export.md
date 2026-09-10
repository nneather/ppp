# 222 — Sports sync `maxDuration` export broke Vercel

**Date:** 2026-09-10
**Module:** sports
**Tracker session:** ad-hoc (Vercel Production red)

## Built

- Production deploys for [220](220-sports-sync-github-actions.md) (`2557e2d`) and [221](221-sports-cfb-beyond-fbs.md) (`044a4c5`) failed on `npm run build` (GitHub Actions `check-and-test` and Vercel, same error).
- SvelteKit rejects a bare `export const maxDuration` on `GET /api/sports/sync`. Valid Kit endpoint exports do not include that name.
- Fixed to the existing Kit/Vercel shape: `export const config = { maxDuration: 60 }` (same as `/library/books/[id]`).

## Decided

- **Use `export const config = { maxDuration }`** on SvelteKit routes — never a top-level `maxDuration` (Next.js-style). Kit’s allowlist is `GET`/`POST`/… plus `config`, `prerender`, `trailingSlash`, `entries`, `fallback`, or `_`-prefixed names.
- Keep the 60s hint for a future Pro upgrade; Hobby still caps at 10s. GHA remains the 10m ticker ([220](220-sports-sync-github-actions.md)).

## Schema changes

- None.

## New components / patterns added

- None. Route convention now called out in `.cursor/rules/sveltekit-routes.mdc`.

## Open questions surfaced

- None. Land this on `main` to unblock Production.

## Surprises (read these before the next session)

- `npm run check` and unit tests were green on 220/221; only **`npm run build`** (CI + Vercel) caught the invalid export. Local `adapter-auto` without Vercel env still compiles once `config` is used.
- Live Production is still the Sep 9 library batch (`9d9c6c7`); sports GHA sync and CFB pagination are on `main` but not deployed.

## Carry-forward updates

- [x] components.mdc updated (no new component)
- [x] AGENTS.md inventory updated (no new helper)
- [x] new env vars documented (none)
- [x] tracker Open Questions updated
