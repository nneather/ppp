# Monthly backup — restore verification

One-time smoke test for the two-file `pg_dump` backup spec ([PLAN.md](../../PLAN.md) › Data safety, [055](../../docs/decisions/055-ci-backups.md)).

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

After secrets are set, trigger **Monthly database backup** via Actions → **Run workflow** on `main` (not **Re-run** on an old failed job — that replays stale workflow YAML). Confirm objects appear under `s3://<bucket>/YYYY/`.

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

```bash
dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh
```

Steps mirrored from production restore:

1. `pg_dump -F c` invoicing tables only (same `-t` list as [backup.yml](../../.github/workflows/backup.yml)).
2. Scratch Postgres 17 container.
3. Minimal schema + **profiles row loaded first** (FK parent for `clients.user_id`, etc.).
4. `pg_restore --data-only --disable-triggers`.
5. Assert at least one live `clients` row.

Retention: keep all monthly dumps in R2 for now; revisit pruning later.
