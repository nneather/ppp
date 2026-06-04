# 048 — Projects weekly check-in progress

**Date:** 2026-06-04
**Module:** projects
**Tracker session:** Ad-hoc (check-in detail)

## Built

- Migration [`20260604100000_project_updates_progress.sql`](../supabase/migrations/20260604100000_project_updates_progress.sql) — `progress_value`, `progress_max`, `progress_note` on `project_updates` with bounds CHECK.
- [`src/lib/projects/progress.ts`](../src/lib/projects/progress.ts) — `formatProgressLabel` (`42/100%` when max is 100, else `5/12`), `progressPercent`, parsers.
- Weekly draft + save/load/carry-forward wired through [`actions.ts`](../src/lib/projects/server/actions.ts), [`loaders.ts`](../src/lib/projects/server/loaders.ts).
- [`project-tree.svelte`](../src/lib/components/project-tree.svelte) — optional “Track progress” under Reason/Next steps; native `<progress>` bar; Value / Of / Note inputs.

## Decided

- **NULL `progress_value` = off** — no separate boolean column.
- **Default denominator 100** when user enables progress (`DEFAULT_PROGRESS_MAX`).
- **Display:** `X/100%` when max is 100; otherwise `X/max` plus optional note under the bar.
- **Carry-forward:** progress fields copy from the **most recent** `project_updates` row with `week_of` strictly before the selected week (not only the immediately previous Sunday). Implemented in [`carry-forward.ts`](../src/lib/projects/carry-forward.ts) + [`loadCarryForward`](../src/lib/projects/server/loaders.ts).

## Schema changes

- `supabase/migrations/20260604100000_project_updates_progress.sql`

## Verification

- `npm run test` — `progress.test.ts` + `filter.test.ts`
- Apply migration + `npm run supabase:gen-types` on hosted project before save in prod.

## Carry-forward updates

- [x] `POS_Schema_v1.md` updated
