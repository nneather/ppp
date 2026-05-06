# Library language audit

One-off or repeatable script to find `books` rows marked **English** that are likely **German** (or other languages via Open Library hints), output a CSV for review, and optionally apply updates.

## Environment

Uses the same dotenv pattern as other CLI scripts (repo root `.env` + `.env.local`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIBRARY_AUDIT_DATABASE_URL` | Yes* | Postgres **direct** connection string (Supabase Dashboard → Connect → **URI**, not the pooler if you hit statement limits). |
| `LIBRARY_LANGUAGE_AUDIT_CONFIRM` | For `--apply` | Must be exactly `yes` to write updates. |

\*If `LIBRARY_AUDIT_DATABASE_URL` is unset, the script falls back to `LIBRARY_SRC_DATABASE_URL` (same as [library-migrate-local-to-prod](../library-migrate-local-to-prod/README.md)).

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
