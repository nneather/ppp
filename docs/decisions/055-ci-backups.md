# 055 — CI + monthly backups (review 051, Session R5)

**Date:** 2026-07-06
**Module:** cross-module (repo infra)
**Tracker session:** Review remediation R5 — final 051 leg

## Built

- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `npm ci`, `npm run check`, `npm run test` on `push` and `pull_request` (Node 24, npm cache).
- [`.github/workflows/backup.yml`](../../.github/workflows/backup.yml) — monthly cron `0 8 1 * *` + `workflow_dispatch`; two `pg_dump -F c` files uploaded to private Cloudflare R2 (`YYYY/ppp-invoicing-YYYY-MM.dump`, `YYYY/ppp-library-YYYY-MM.dump`).
- [`src/lib/vite/patch-sveltekit-pwa.ts`](../../src/lib/vite/patch-sveltekit-pwa.ts) — self-cleaning `// @ts-expect-error` on `plugins.flat(Infinity)` so CI `check` is green without hiding future regressions.
- [`scripts/backup-restore-verify/`](../../scripts/backup-restore-verify/) — local restore smoke script + README (profiles-first ordering).

## Decided

- **Backup store: Cloudflare R2 private bucket** — repo is public (`nneather/ppp`); in-repo dumps, release artifacts, and Actions artifacts are world-readable. Rejected: co-located Supabase Storage (weak DR).
- **Retention: keep all** monthly dumps for now; revisit pruning later.
- **GitHub Actions DB URL: Session Pooler (port 5432)**, not Direct — Direct is IPv6-only; GitHub-hosted runners are IPv4-only. Session pooler supports `pg_dump`; transaction pooler (6543) does not.
- **CI check isolation:** `@ts-expect-error` on the single known Vite type-depth error. Rejected: `continue-on-error` on the check step (masks all regressions); ignoring the whole file (masks future edits there).
- **Library dump table set corrected** — dropped stale `categories` / `book_categories`; added `publishers`. Authoritative list matches [`database.ts`](../../src/lib/types/database.ts).

### Dump table sets

**Invoicing** (`ppp-invoicing-YYYY-MM.dump`):

`clients`, `client_rates`, `time_entries`, `invoices`, `invoice_line_items`

**Library** (`ppp-library-YYYY-MM.dump`):

`books`, `people`, `series`, `publishers`, `bible_books`, `ancient_texts`, `book_authors`, `book_bible_coverage`, `book_ancient_coverage`, `book_topics`, `essays`, `essay_authors`, `scripture_references`

Both reference `profiles` (and some `audit_log`) — excluded from dumps; **load `profiles` row first** on restore.

## Schema changes

- None.

## New components / patterns added

- GitHub Actions CI + backup workflows under `.github/workflows/`.
- `scripts/backup-restore-verify/restore-smoke.sh` — Docker-based restore verification (profiles schema + data row, then full invoicing `pg_restore`).

## GitHub Actions secrets (set in repo Settings → Secrets)

| Secret | Purpose |
|---|---|
| `BACKUP_DATABASE_URL` | Prod Session Pooler URI (`postgres.<ref>` @ `aws-0-<region>.pooler.supabase.com:5432`) |
| `R2_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Private bucket name |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |

Set via `gh secret set <NAME>` (values never committed). See [`scripts/backup-restore-verify/README.md`](../../scripts/backup-restore-verify/README.md).

## Restore verification

**Procedure** (documented; run once before trusting backups):

1. Set the five GitHub secrets above.
2. Actions → **Monthly database backup** → **Run workflow** (`workflow_dispatch`).
3. Confirm `YYYY/ppp-invoicing-YYYY-MM.dump` and `YYYY/ppp-library-YYYY-MM.dump` in R2.
4. Local smoke (optional, same table sets):  
   `npx dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh`  
   Requires Docker. Seeds `profiles` schema + owner row from prod, then `pg_restore` invoicing dump; asserts live `clients` count > 0.

**Session note:** Agent session could not execute the live smoke (Docker daemon not running on dev machine). Script + workflow are in place; Parker should run steps 1–4 once secrets and R2 bucket exist.

**2026-07-06 follow-up (wrong DB URL fix):**

- Root cause of first failure: `BACKUP_DATABASE_URL` was Direct (`db.*.supabase.co`, IPv6). Updated via `derive-pooler-url.ts` → `aws-1-us-east-2.pooler.supabase.com` (ppp-prod region `us-east-2`, cluster `aws-1` not `aws-0`).
- Second failure: `pg_dump` 16 vs server 17.6 — workflow now installs `postgresql-client-17` and prepends `/usr/lib/postgresql/17/bin` to `PATH`.
- **Verified on GitHub Actions run 28829919025:** both `pg_dump` steps green.
- **2026-07-06 explicit pg_dump path (run 28830741867):** `pg_dump (PostgreSQL) 17.10` in dump step; both dumps green.
- **R2 upload still blocked:** `InvalidArgument: Credential access key has length 64, should be 32` — Secret Access Key was likely set as `R2_ACCESS_KEY_ID`. Parker: 32-char Access Key ID → `R2_ACCESS_KEY_ID`, 64-char Secret → `R2_SECRET_ACCESS_KEY`, then re-run workflow.
- **Full E2E verified 2026-07-06** (run [28830982000](https://github.com/nneather/ppp/actions/runs/28830982000)): fresh `workflow_dispatch` on `main` (not Re-run on stale jobs); `pg_dump` 17.10; invoicing + library dumps uploaded to R2 `2026/ppp-invoicing-2026-07.dump` and `2026/ppp-library-2026-07.dump`. Local `restore-smoke.sh` still optional.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- `npm run check` now exits 0 (was 1 error pre-session); `@ts-expect-error` will flip to an error if upstream Vite types fix the depth issue — intentional self-cleaning signal.
- Ubuntu `postgresql-client` from apt (backup workflow) is sufficient; no PGDG pin required unless prod major version diverges from client capabilities.
- **ppp-prod** is on pooler cluster **`aws-1-us-east-2`**, not `aws-0-us-east-2`. `derive-pooler-url.ts` probes `aws-{0,1,2,3}-<region>`.
- GitHub runner ships `postgresql-client` 16 on PATH even after installing 17 — workflow calls `/usr/lib/postgresql/17/bin/pg_dump` explicitly. **Re-run all jobs** on an old failed run replays stale workflow YAML (still hits v16); use **Run workflow** on `main` instead.

## Carry-forward updates

- [x] components.mdc updated (n/a)
- [x] AGENTS.md inventory updated (GitHub Actions secrets table)
- [x] new env vars documented (GitHub secrets — not local `.env`)
- [x] PLAN.md refreshed (051 remediation complete, Data safety table list fixed)
