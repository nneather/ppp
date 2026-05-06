# Library language audit

One-off or repeatable script to find `books` rows marked **English** that are likely **German** (or other languages via Open Library hints), output a CSV for review, and optionally apply updates.

## Environment

**Hosted Supabase:** This repo does not use a local Docker Postgres stack for day-to-day work. Point the URL variables at your **hosted** project: Supabase Dashboard → **Project Settings → Database** → **Connection string** → **URI** (direct / session mode is fine for this script). A connection to `127.0.0.1:54322` only works if you truly have local Supabase running.

Uses the same dotenv pattern as other CLI scripts (repo root `.env` + `.env.local`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIBRARY_DST_DATABASE_URL` | Yes* | Same **destination** Postgres URI as [library-migrate](../library-migrate-local-to-prod/README.md) — usually your hosted library (Dashboard → **Connect → Direct**). |
| `LIBRARY_SRC_DATABASE_URL` | Fallback* | Used if DST and `LIBRARY_AUDIT_DATABASE_URL` are unset. |
| `LIBRARY_AUDIT_DATABASE_URL` | Optional | Overrides DST/SRC when you want to audit another database without changing migrate vars. |
| `LIBRARY_LANGUAGE_AUDIT_CONFIRM` | For `--apply` | Must be exactly `yes` to write updates. |

\*Connection resolution order: **`LIBRARY_AUDIT_DATABASE_URL`** → **`LIBRARY_DST_DATABASE_URL`** → **`LIBRARY_SRC_DATABASE_URL`**. If migrate env already has **DST** pointed at your live hosted project, you do not need a separate audit URL.

## Run

```bash
# Dry run — prints TSV to stdout and writes data/library_language_audit.tsv
npm run library:language-audit

# First 200 candidates only
npm run library:language-audit -- --limit 200

# Apply German updates (conservative: Open Library lists German, or strong title heuristics)
LIBRARY_LANGUAGE_AUDIT_CONFIRM=yes npm run library:language-audit -- --apply

# Also update when title has German umlauts even if OL has no language data (riskier)
LIBRARY_LANGUAGE_AUDIT_CONFIRM=yes npm run library:language-audit -- --apply --aggressive
```

## Signals

- **Open Library** — `GET https://openlibrary.org/isbn/{isbn}.json` then optional work JSON; `/languages/ger` → German.
- **Title / subtitle** — German umlauts `äöüÄÖÜß`, common articles ` der ` / ` die ` / ` das ` (word boundaries).
- **Genre** — `German Language Tools` or title containing “Deutsch” / “deutsche”.

`--apply` without `--aggressive` only updates when **Open Library** reports German **or** OL German plus umlaut/genre hint. With `--aggressive`, umlaut-only rows (no OL German) are also updated to `german`.

## Safety

- Only targets `language = 'english'` and `deleted_at IS NULL`.
- Never downgrades a row already set to `german`.
- Throttles Open Library requests (~300ms between ISBN fetches).
