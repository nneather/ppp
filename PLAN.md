# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-06-03 — **Projects Session 2 complete** ([046](docs/decisions/046-projects-session-2-dashboard-filters.md)); dashboard strip + filters shipped. Session 1: [045](docs/decisions/045-projects-session-1-tree-checkin.md).
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Projects — Session 3 next:** Session 2 shipped — dashboard status strip, attention tile, trend arrows, URL filters ([046](docs/decisions/046-projects-session-2-dashboard-filters.md)). Tracker: [POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md). **Owner phone smoke** still optional (create under Work, check-in ×2 same week).

**Library — maintenance / trip use:** Trip owner QA **signed off 2026-06-03** ([043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). PWA is **passable**; **performance** work continues in a separate chat. No library build sessions until Wave 2 (August) or ad-hoc fixes.

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first) — library usable
- **2026-08** — return; library Wave 2 (Turabian 20-row QA, megacomponent split, essays Q5)
- **2026-09** — fall-semester-ready citations (library)

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ **Trip build complete** — QA signed off 2026-06-03. **Wave 2 (Aug):** shelf Turabian QA, megacomponent split, essays Q5. PWA perf: separate thread. |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | 🟢 **Session 2 done** — dashboard glance + filters. **Next:** Session 3 links/tasks/audit. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [046 — Projects Session 2: dashboard glance + filters](docs/decisions/046-projects-session-2-dashboard-filters.md) (2026-06-03) — status strip, attention tile, URL filters, `not_started` lifecycle.
- [045 — Projects Session 1: tree + weekly check-in](docs/decisions/045-projects-session-1-tree-checkin.md) (2026-06-03) — migration, inline tree, PK upsert (NEW-D).
- [043 — Library trip QA sign-off + projects handoff](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md) (2026-06-03) — owner QA passable; projects kickoff.
- [041 — Library module retro](docs/decisions/041-library-module-retro.md) — kickoff playbook + footgun registry.

---

## Session handoff

**Projects Session 3:** Links + tasks + audit enrichment — see tracker Session 3. Helpers: `src/lib/projects/filter.ts`, `loadLatestHealth` in loaders.

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` verified **2026-05-19** (033); re-run after library/projects code changes.

---

## Next up

1. **Projects Session 3** — links, tasks, audit enrichment (slippable post-v1).
2. **Library (parallel / low priority):** PWA performance (separate chat); August Wave 2 when shelf is home.
3. **Invoicing:** first real-client send cadence (owner-driven).
