# 042 — RLS smoke harness (ppp-staging)

**Date:** 2026-06-03
**Module:** platform / library
**Tracker:** closes deferred viewer RLS acceptance rows (DB layer)

## Built

- **`scripts/rls-smoke/`** — staging-only env loader, `ensure-test-users.ts`, `run.ts`, library matrix suite (15 cases + dry-run).
- **npm scripts:** `test:rls`, `test:rls:ensure-users`, `supabase:link:staging`, `supabase:doctor:staging`, `supabase:db:push:staging`, `supabase:db:push:dry:staging`.
- **`.env.staging.example`** — template for ppp-staging `SUPABASE_REF`.
- Docs: [supabase/README.md](../../supabase/README.md) two-project table, [scripts/rls-smoke/README.md](../../scripts/rls-smoke/README.md), runbook §B pointer.

## Decided

- **ppp-staging** (existing org project) is the RLS target; prod `.env.local` is never loaded by smoke scripts.
- **No prod data clone** for smoke — disposable `rls-smoke-*` rows + service-role cleanup.
- **Tracker scripture row:** case 14 asserts current policy (viewer-write can insert refs on any book); product may differ from tracker wording.

## Schema changes

- None.

## New components / patterns added

- [scripts/rls-smoke/README.md](../../scripts/rls-smoke/README.md) — env, setup, tracker mapping.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `user_permissions` upsert uses `onConflict: 'user_id,module'`.
- Case 06 logs whether viewer soft-delete via `deleted_at` UPDATE is allowed (RLS-dependent).

## Carry-forward updates

- [x] AGENTS.md env table + scripts
- [x] MODULE_KICKOFF_PLAYBOOK.md
- [x] library-trip-qa-runbook.md
- [x] POS_Library_Build_Tracker.md header
- [ ] Owner: fill `.env.staging` + `.env.staging.local`, `db push:staging`, `test:rls:ensure-users`, `test:rls`
