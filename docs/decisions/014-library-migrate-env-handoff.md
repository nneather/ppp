# 014 — Library migrate env docs + trip handoff

**Date:** 2026-05-03  
**Module:** library  
**Tracker session:** Ad-hoc (Path B source → destination + Session 5.5 polish)

## Built

- [scripts/library-migrate-local-to-prod/README.md](../scripts/library-migrate-local-to-prod/README.md) — env var table (`LIBRARY_SRC_DATABASE_URL`, `LIBRARY_DST_DATABASE_URL`, `LIBRARY_MIGRATE_CONFIRM`), Direct URI guidance, URI hygiene (trailing typo, percent-encoding reserved password chars), **source connectivity** (hosted SRC/DST vs optional `127.0.0.1:54322`), `--allow-non-empty-dst` via full `npx dotenv … tsx` when npm script is not enough.
- [AGENTS.md](../AGENTS.md) — `.env.local` examples row: three `LIBRARY_*` keys + README link + **Connect → Direct** clarification for SRC/DST.
- [`.cursor/plans/library_1–2h_agent_run_bec2947b.plan.md`](../../.cursor/plans/library_1–2h_agent_run_bec2947b.plan.md) — Phase **3b** retitled **source → destination**; walkthrough and success criteria no longer assume Docker Desktop or `127.0.0.1:54322` as the default source.

## Decided

- **Path B endpoints:** Default documentation assumes **two Supabase-hosted Postgres URIs** (Dashboard **Connect → Direct**) for SRC and DST; local `54322` is optional, not required.
- **Hosted connection string:** Supabase **Connect → Direct** URI is the right shape for `postgres` + `migrateLibraryData.ts` (not MCP / Framework client snippets).
- **Dry-run order:** Script connects to **destination** first (`fetchOwnerId`); fix `LIBRARY_DST_*` auth before debugging **source** reachability.

## Schema changes

- None.

## New components / patterns added

- None (docs + small UI visibility tweak only).

## Open questions surfaced

- Full **`library:migrate:apply`** not executed in the initial session: when **`LIBRARY_SRC_DATABASE_URL`** pointed at **`127.0.0.1:54322`**, local Postgres was not reachable (`ECONNREFUSED`). **Correction (same day):** Parker’s workflow is **Supabase-project-only** (no Docker Desktop). Use **two Dashboard `Connect → Direct` URIs** for SRC (corpus project/branch) and DST (target prod). Optional local `54322` remains documented for contributors who run `supabase start`.

## Surprises (read these before the next session)

- **Supabase-only Path B:** SRC and DST are **just Postgres URLs** — neither must be `127.0.0.1:54322`. `ECONNREFUSED` on `54322` only applies when SRC is explicitly that host.

- A stray **`>`** at the end of `LIBRARY_DST_DATABASE_URL` invalidates the URI.
- A **`]`** (or other reserved character) inside the password must be **percent-encoded** in the URI segment, or parsers/auth may mis-read the password.
- `npm run library:migrate:*` loads **`.env` then `.env.local`** — both URLs belong in `.env.local` (or export them) for the npm wrappers.

## Carry-forward updates

- [x] README env / troubleshooting
- [x] AGENTS.md `.env.local` row
- [x] `PLAN.md` — Path B handoff uses Dashboard SRC/DST URIs (no Docker Desktop chain)
- [ ] components.mdc — not needed (no new component)
