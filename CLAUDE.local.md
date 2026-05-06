# Local overrides

## Supabase

**Hosted only** — no local Docker / `supabase start` for this project. CLI scripts that need Postgres (`library:language-audit`, `library:migrate:*`, etc.) must use the **hosted** project's **Dashboard → Connect → Direct** URI in `.env.local` — typically `LIBRARY_DST_DATABASE_URL` / `LIBRARY_SRC_DATABASE_URL` for migrate, which `library:language-audit` now reuses in that order (after optional `LIBRARY_AUDIT_DATABASE_URL`). If a URL points at `127.0.0.1:54322`, it will fail unless something local is actually running.
