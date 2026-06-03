# Perf smoke

Asserts `Server-Timing` budgets on authenticated HTML routes after login.

## Setup

Copy credentials into `.env.staging.local` (or `.env.local` for prod smoke):

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PERF_SMOKE_EMAIL` / `PERF_SMOKE_PASSWORD` (owner test user)

## Run

```bash
npm run test:perf
```

Optional overrides (milliseconds):

- `PERF_BUDGET_LIBRARY_NAV` (default 1200)
- `PERF_BUDGET_LIBRARY_SEARCH` (default 1500)
- `PERF_BUDGET_DASHBOARD` (default 800)

Targets the app origin in `PERF_SMOKE_ORIGIN` (default `http://localhost:5173`). Start `npm run dev` first for local runs.
