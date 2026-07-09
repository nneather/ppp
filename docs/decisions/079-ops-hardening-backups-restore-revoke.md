# 079 — Ops hardening: weekly backups, proven restore, denorm REVOKE

**Date:** 2026-07-09
**Module:** cross-module (ops)
**Tracker session:** Ad-hoc — closes [066](066-operational-resilience-review.md) Q10–Q13 (Q14 nav watchdog already in [072](072-pwa-cold-start-resilience.md))

## Built

- [`.github/workflows/backup.yml`](../../.github/workflows/backup.yml): cron monthly → **weekly** `0 8 * * 1`; `profiles` added to invoicing dump; third `ppp-projects-YYYY-MM.dump` (`projects`, `project_updates`, `project_tasks`, `project_links`) + R2 upload. Workflow title → "Weekly database backup".
- [`scripts/backup-restore-verify/restore-smoke.sh`](../../scripts/backup-restore-verify/restore-smoke.sh) rewritten and **run green**:
  - Dropped broken `pg_dump --where` + live-prod profiles schema/data dance.
  - Auto-derives Session Pooler URL when `.env.local` has Direct (IPv6) URI (Docker cannot reach Direct).
  - Restores via `pg_restore --section=pre-data` then `--section=data` (post-data skipped — no `auth.users` / trigger bootstrap).
  - Invoicing assert: **2** live clients, **1** live profile.
  - Library assert: **1379** books, **1509** book_authors, **555** scripture_references.
- README reconciled to the real restore flow.
- Migrations applied to prod:
  - `20260709222420_revoke_public_execute_denorm.sql` — `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated` on denorm helpers.
  - `20260709222910_revoke_anon_execute_denorm.sql` — also `REVOKE … FROM anon` (explicit grant remained after PUBLIC revoke).
  - `20260709222836_revoke_anon_execute_denorm.sql` — empty hung-CLI placeholder (already applied; left as documented no-op).
- [`.cursor/rules/db-changes.mdc`](../../.cursor/rules/db-changes.mdc): checklist line for new SECURITY DEFINER → REVOKE PUBLIC **and** anon.
- [040](040-security-advisor-hardening.md) accepted-`authenticated` list extended with the two denorm functions.

## Decided

- **Restore smoke uses dump pre-data/data, not migrations-built schema** — 066 Q12 preferred migrations + `--data-only --disable-triggers`, but a vanilla scratch container needs `auth`/roles bootstrap. Pre-data/data proves dump shape + row counts without that scaffolding. True DR into a fresh Supabase project still: run migrations, then `pg_restore --data-only --disable-triggers` of R2 archives.
- **Library dump source for smoke = fresh `pg_dump` from prod**, not the R2 object — `.env.local` has no R2 creds; mechanics identical to the workflow `-t` list.
- **REVOKE must target both PUBLIC and anon** — Supabase had an explicit `anon=X` ACL in addition to PUBLIC; PUBLIC-only revoke left Advisor WARNs and `has_function_privilege('anon', …)` true.

## Schema changes

- `20260709222420_revoke_public_execute_denorm.sql`
- `20260709222836_revoke_anon_execute_denorm.sql` (no-op placeholder)
- `20260709222910_revoke_anon_execute_denorm.sql`

## New components / patterns added

- None (ops scripts + workflow only).

## Open questions surfaced

- First unattended **weekly** cron: next Monday 08:00 UTC — glance Actions tab (GitHub email on scheduled failure is easy to miss).
- Optional: add R2 creds to `.env.local` later to rehearse the literal R2 artifact instead of a fresh dump.
- Projects dump is in the workflow but not yet asserted in restore-smoke (invoicing + library cover the critical path; projects can follow).

## Surprises (read these before the next session)

- `REVOKE FROM PUBLIC` alone was insufficient — `proacl` still showed `anon=X/postgres`. Same two-step lesson as 040 (`20260528140000` then `20260528150000`).
- Docker + Direct URI fails with "No address associated with hostname" (IPv6); pooler derive is required for local smoke.
- `pg_restore` inside the container must pass `-U postgres` or it tries role `root`.

## Carry-forward updates

- [x] components.mdc — n/a
- [x] AGENTS.md inventory — n/a
- [x] new env vars — none
- [x] PLAN.md Data safety pending items cleared
- [x] security-review subagent — no medium+ findings ([review](a48378e9-dfab-4b31-b31d-684ddb63ddbb))
- [x] Pushed to `main` (`36de676`)
- [ ] Owner: phone smoke cold-start / nav watchdog / chunk recovery ([072](072-pwa-cold-start-resilience.md))
- [ ] Owner: after next weekly backup run, confirm three objects in R2 (`invoicing` / `library` / `projects`)
