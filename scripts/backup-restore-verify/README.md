# Weekly backup — restore verification

Smoke test for the three-file `pg_dump` backup spec ([PLAN.md](../../PLAN.md) › Data safety, [055](../../docs/decisions/055-ci-backups.md), [066](../../docs/decisions/066-operational-resilience-review.md)).

## GitHub Actions secrets

Set in **Settings → Secrets and variables → Actions** (repo `nneather/ppp`):

| Secret | Value |
|---|---|
| `BACKUP_DATABASE_URL` | Prod **Session Pooler** URI (Dashboard → Connect → Session pooler, port **5432**). IPv4-safe for GitHub runners; Direct URI is IPv6-only. |
| `R2_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Private bucket name (public repo — never store dumps in-repo or release artifacts) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |

```bash
gh secret set BACKUP_DATABASE_URL
gh secret set R2_ENDPOINT
gh secret set R2_BUCKET
gh secret set R2_ACCESS_KEY_ID
gh secret set R2_SECRET_ACCESS_KEY
```

After secrets are set, trigger **Weekly database backup** via Actions → **Run workflow** on `main` (not **Re-run** on an old failed job — that replays stale workflow YAML). Confirm objects appear under `s3://<bucket>/YYYY/`.

### Wrong URL symptoms

If `BACKUP_DATABASE_URL` is the **Direct** URI (`db.<ref>.supabase.co`), the workflow fails with:

```text
pg_dump: error: connection to server at "db.<ref>.supabase.co" (2600:...)
Network is unreachable
```

GitHub-hosted runners are **IPv4-only**; Direct resolves to **IPv6 only**. Fix: Supabase Dashboard → **Connect** → **Session pooler** → URI, port **5432**, user `postgres.<ref>`, then:

```bash
gh secret set BACKUP_DATABASE_URL --body 'postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

Do **not** use Transaction pooler (port **6543**) — `pg_dump` is not supported there.

`server version: 17.6; pg_dump version: 16.14` — runner default client is v16; workflow must call `/usr/lib/postgresql/17/bin/pg_dump` explicitly (see [backup.yml](../../.github/workflows/backup.yml)).

Pooler host is **not always `aws-0-<region>`** — Supabase assigns `aws-0`, `aws-1`, etc. per project. Wrong cluster → `Tenant or user not found`. Copy the host from **Connect → Session pooler**, or derive from Direct password:

```bash
npx dotenv -e .env.local -e .env -- npx tsx scripts/backup-restore-verify/derive-pooler-url.ts | gh secret set BACKUP_DATABASE_URL
```

### R2 upload errors

`Credential access key has length 34, should be 32` — `R2_ACCESS_KEY_ID` is wrong (often the Secret Access Key or Account ID was pasted). Re-copy from R2 → Overview → API Tokens: **Access Key ID** is exactly 32 characters; **Secret Access Key** goes in `R2_SECRET_ACCESS_KEY` only.

`Credential access key has length 64, should be 32` — the **Secret Access Key** was pasted into `R2_ACCESS_KEY_ID` by mistake. Swap: 32-char value → `R2_ACCESS_KEY_ID`, 64-char value → `R2_SECRET_ACCESS_KEY`.

`R2_ENDPOINT` must be the base URL only (`https://<accountid>.r2.cloudflarestorage.com`) — no `/bucket-name` suffix.

## Local restore smoke (no R2)

Requires Docker. Uses `LIBRARY_DST_DATABASE_URL` or `BACKUP_DATABASE_URL` from `.env.local`.

If the URL is a **Direct** host (`db.<ref>.supabase.co`), the script auto-derives a Session Pooler URI via [`derive-pooler-url.ts`](derive-pooler-url.ts) — Docker on macOS cannot reach IPv6-only Direct.

Re-dumps the same `-t` lists as [backup.yml](../../.github/workflows/backup.yml) from prod (no R2 credentials needed locally), then restores into a scratch Postgres 17 container.

```bash
npx dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh
```

Steps:

1. `pg_dump -F c` invoicing tables **including `profiles`**, and library tables (same `-t` lists as the workflow).
2. Scratch Postgres 17 container.
3. For each archive: `pg_restore --section=pre-data` then `--section=data` (`--no-owner --no-privileges`). **Post-data is skipped** (FKs, triggers, RLS, indexes) so the smoke does not need `auth.users` / `write_audit_log` / roles bootstrap — we only assert row counts.
4. Assert ≥1 live `profiles` + `clients` (invoicing) and ≥1 `books` / `book_authors` / live `scripture_references` (library).

True disaster recovery into a fresh Supabase project still uses migrations for schema, then `pg_restore --data-only --disable-triggers` (superuser) of the R2 archives — this smoke proves the dump shape and data land, not the full migration+FK path.

Retention: keep all weekly dumps in R2 for now; revisit pruning later.
