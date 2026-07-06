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

After secrets are set, trigger **Monthly database backup** via Actions → `workflow_dispatch` and confirm objects appear under `s3://<bucket>/YYYY/`.

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
