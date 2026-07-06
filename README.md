# ppp — Parker's Platform

Personal productivity platform: **invoicing** (time entries → PDF invoices via email), **library** (theological library with Turabian citations, ISBN/barcode intake, scripture-reference OCR), and **projects** (weekly check-ins + MYN task zones). Built mobile-first as an installable PWA.

**Stack:** SvelteKit (Svelte 5 runes) + TypeScript strict · Supabase (Postgres/Auth/Edge Functions, single hosted project) · Tailwind v4 + shadcn-svelte · Vercel.

## If you are an AI agent (or a new developer)

Read in this order — do not skip:

1. [AGENTS.md](AGENTS.md) — operating guide: session template, carry-forward inventory, env vars, non-negotiables
2. [PLAN.md](PLAN.md) — rolling dashboard: current focus, active modules, next up
3. [docs/decisions/](docs/decisions/) — read the latest 3 entries before any build session
4. [supabase/README.md](supabase/README.md) — hosted-only Supabase workflow (**no local Docker stack**)

Cursor loads `.cursor/rules/*.mdc` automatically; outside Cursor, read them manually (listed in AGENTS.md).

## Getting started

```sh
npm install
cp .env.example .env          # fill in SUPABASE_REF
# create .env.local with PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY (see AGENTS.md env table)
npm run supabase:link         # link CLI to the hosted project
npm run supabase:doctor       # verify ref/URL agreement
npm run dev
```

There is no local database. Migrations apply to the hosted project: `npm run supabase:db:push:dry` to review, then `npm run supabase:db:push`, then `npm run supabase:gen-types`.

## Gates

- `npm run check` — svelte-check
- `npm run test` — Vitest (pure-function suites: Turabian, week math, billing lines)
- `npm run test:rls` — RLS matrix against **ppp-staging** only
- `npm run ship-library` / `ship-library:apply` — library schema gate

## Deployment

Vercel (app) + Supabase (DB/Auth/Edge Functions). Full go-live runbook: [docs/Supabase_deployment_and_go_live.md](docs/Supabase_deployment_and_go_live.md).
