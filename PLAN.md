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

**Optional polish (separate chat):** Health/lifecycle status appearance — see **Session prompts** below; attach your design doc when ready.

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` verified **2026-06-03** (Session 2); re-run after projects code changes.

---

## Session prompts (copy-paste)

### Start Projects Session 3 — links + tasks + audit

```
Session: projects #3 — links + tasks + audit + smoke
Tracker: docs/POS_Projects_Build_Tracker.md, Session 3
Read: AGENTS.md, .cursor/rules/sveltekit-routes.mdc, .cursor/rules/components.mdc,
  src/lib/types/database.ts, src/lib/types/projects.ts,
  src/lib/projects/server/loaders.ts, src/lib/projects/server/actions.ts,
  docs/decisions/046-projects-session-2-dashboard-filters.md,
  docs/decisions/045-projects-session-1-tree-checkin.md
Supabase: hosted only — project_tasks needs a NEW migration file (footgun #4); project_links table already in v1
Goal: Inline project_links editor, resolve T1 (task due dates?) → project_tasks migration + task UI (add/toggle/reorder), extend audit-log projects group, full owner phone smoke.
Acceptance:
 - [ ] project_links CRUD inline on project (or metadata sheet — pick one surface and stay consistent)
 - [ ] project_tasks migration + types if T1 resolved; task add/toggle/reorder UI
 - [ ] /settings/audit-log projects filter complete (verify revertible tables)
 - [ ] Full smoke: create → check-in → dashboard glance → link/task → audit
 - [ ] npm run check passes (ignore pre-existing patch-sveltekit-pwa.ts if unchanged)
 - [ ] Mobile-width pass on new surfaces
End-of-session deliverables:
 - [ ] Tracker Session 3 marked done with notes
 - [ ] docs/decisions/047-projects-session-3-links-tasks-audit.md filed
 - [ ] PLAN.md + AGENTS.md inventory if new patterns
 - [ ] components.mdc if new reusable UI

Context: S1 = tree + check-in ([045]); S2 = dashboard strip, attention tile, trends, URL filters ([046]).
Open: T1 task due dates (decide at session start); Session 1 phone smoke still unchecked on tracker if not done yet.
```

### Polish — status appearance (attach your design doc)

```
Session: projects — status appearance polish (ad-hoc, not a tracker session)
Read: AGENTS.md, .cursor/rules/components.mdc,
  src/lib/types/projects.ts (HEALTH_STATUS_LABELS, LIFECYCLE_STATUS_LABELS),
  src/lib/components/health-trend-badge.svelte,
  src/lib/components/project-tree.svelte (healthSegmentClass),
  src/lib/components/project-status-strip.svelte,
  src/lib/components/project-filter-bar.svelte,
  docs/decisions/046-projects-session-2-dashboard-filters.md
Goal: Update health + lifecycle status appearance across the projects module to match the attached design document.
Acceptance:
 - [ ] All five health statuses + lifecycle badges match the doc (colors, labels, sizing, dark mode)
 - [ ] Consistent treatment in: inline 5-segment picker, HealthTrendBadge, dashboard strip, filter bar
 - [ ] No regressions to filter URLs, trend arrows, or check-in save behavior
 - [ ] npm run check passes; mobile-width spot-check on /dashboard and /projects
End-of-session deliverables:
 - [ ] Short note in docs/decisions/ or tracker Notes if the doc encodes a lasting convention
 - [ ] components.mdc if a shared token/map pattern is extracted

Attach: [paste or @-mention your status appearance document here]
```

---

## Next up

1. **Projects Session 3** — links, tasks, audit enrichment (slippable post-v1).
2. **Library (parallel / low priority):** PWA performance (separate chat); August Wave 2 when shelf is home.
3. **Invoicing:** first real-client send cadence (owner-driven).
