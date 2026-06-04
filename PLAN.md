# PLAN.md — Parker's Platform (ppp)

**Last updated:** 2026-06-04 — **Projects v1 complete** (045–047). **Library Wave 2** starting (essays/article-level in scope). Session 1 phone smoke signed off; optional full end-to-end projects smoke on tracker.
**How to use this file:**
- Cursor reads it automatically.
- For the Claude.ai "Parker's Platform" project, paste the contents of this file at the start of any session that needs current state.
- At the end of every session in either tool, update this file before stopping.

---

## Current focus

**Projects — v1 feature-complete:** Tree + check-in ([045]), dashboard + filters ([046]), MYN tasks + links + audit ([047](docs/decisions/047-projects-session-3-myn-tasks-links-audit.md)). Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md). **Session 1 phone smoke** signed off (tree + check-in). **Full end-to-end smoke** (dashboard + tasks + links + audit) still optional on tracker.

**Library — Wave 2 starting now:** Trip QA **signed off 2026-06-03** ([043](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md)). **Fixture-first build** this summer: Turabian formatter incl. **article-level citations (essays UI now IN scope — decided 2026-06-04)**, 20-row QA across all source types, megacomponent split, `.docx` export (hanging indent + italics). PWA perf: separate thread.

Nearest hard dates:
- **2026-05-21** — move to Madison; trip-period workflow (mobile-first) — library usable
- **2026-08** — return; library Wave 2 execution window
- **2026-09** — fall-semester-ready citations, **incl. article-level** (signed articles/essays: ABD, TDNT, IVP dicts, essay collections)

---

## Active modules

| Module | Tracker | State |
|---|---|---|
| Invoicing | [docs/POS_Invoicing_Build_Tracker.md](docs/POS_Invoicing_Build_Tracker.md) | ✅ Code complete (Sessions 1–6). |
| Library | [docs/POS_Library_Build_Tracker.md](docs/POS_Library_Build_Tracker.md) | ✅ Trip build complete — QA signed off 2026-06-03. **Wave 2 (starting this summer, fixture-first):** Turabian formatter incl. **article-level citations (essays UI now IN scope — decided 2026-06-04)**, 20-row QA across all source types, megacomponent split, `.docx` export (hanging indent + italics). PWA perf: separate thread. |
| Projects | [docs/POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md) | ✅ **v1 complete** — tree/check-in, dashboard/filters, MYN `/projects/tasks`, links in Sheet, audit. **Viewer access:** owner-only by design (not deferred debt); revisit only if a collaborator is added — [POS_Projects_Build_Tracker.md](docs/POS_Projects_Build_Tracker.md). **Backlog:** polish, global Now ([MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md)), optional full phone smoke. |

Operating guide: [AGENTS.md](AGENTS.md). Cursor rules: [.cursor/rules/](.cursor/rules/). Full decision archive: [docs/decisions/](docs/decisions/).

---

## Recent decisions (last 3 — full archive in `docs/decisions/`)

- [047 — Projects Session 3: MYN tasks + links + audit](docs/decisions/047-projects-session-3-myn-tasks-links-audit.md) (2026-06-04) — `/projects/tasks`, start-date MYN zones, links editor.
- [046 — Projects Session 2: dashboard glance + filters](docs/decisions/046-projects-session-2-dashboard-filters.md) (2026-06-03) — status strip, attention tile, URL filters, `not_started` lifecycle.
- [045 — Projects Session 1: tree + weekly check-in](docs/decisions/045-projects-session-1-tree-checkin.md) (2026-06-03) — migration, inline tree, PK upsert (NEW-D).
- [043 — Library trip QA sign-off + projects handoff](docs/decisions/043-library-trip-qa-signoff-projects-handoff.md) (2026-06-03) — owner QA passable; projects kickoff.
- [041 — Library module retro](docs/decisions/041-library-module-retro.md) — kickoff playbook + footgun registry.

---

## Session handoff

**Projects (use weekly):**
- `/projects` — inline tree + weekly check-in (`depends('app:projects:tree')`).
- `/dashboard` — domain status strip + attention deep link.
- `/projects/tasks` — MYN zones (Critical / Opportunity / OTH), FRESH sort, defer/promote; `?project=` filter.
- Edit project Sheet — metadata + **links** (edit mode only).
- `/settings/audit-log?module=projects` — includes `project_tasks` soft-delete revert.

**Projects helpers:** `src/lib/projects/` — `week.ts`, `filter.ts`, `server/loaders.ts`, `server/actions.ts`, `server/task-loaders.ts`, `server/task-actions.ts`. Design: [MYN_TASKS_DESIGN.md](docs/MYN_TASKS_DESIGN.md).

**Projects migrations (prod):** `20260603170000_ppp_projects_v1.sql`, `20260603200000_projects_add_not_started_lifecycle.sql`, `20260604030000_ppp_project_tasks_myn.sql`.

**Optional polish (separate chat):** Health/lifecycle status appearance — see **Session prompts** below.

**Library (maintenance only):** [docs/library-trip-qa-runbook.md](docs/library-trip-qa-runbook.md) — complete; viewer §B still deferred without collaborator.

**Supabase workflow:** Hosted `db push` / `deploy-functions` only — [supabase/README.md](supabase/README.md). Library schema: **`npm run ship-library:apply`**.

**Repo gate:** `npm run check` + `npm run test` verified **2026-06-04** (Session 3; pre-existing `patch-sveltekit-pwa.ts` TS only).

**Data safety (monthly export):** Off-Supabase belt-and-suspenders beyond Supabase Pro's 7-day daily backups. Monthly `pg_dump -F c`, two files pushed to a private backup store (GitHub Action / cron):

- `ppp-invoicing-YYYY-MM.dump` — clients, client_rates, time_entries, invoices, invoice_line_items
- `ppp-library-YYYY-MM.dump` — books, people, series, categories, bible_books, ancient_texts, book_authors, book_categories, book_bible_coverage, book_ancient_coverage, essays, essay_authors, scripture_references, book_topics

Notes: both reference `profiles`/`audit_log` — a restore loads the single `profiles` row first. Verify with one test restore to scratch before trusting. Projects export deferred (low change rate). PITR add-on intentionally skipped (cost vs. solo value).

---

## Session prompts (copy-paste)

### Projects — optional full phone smoke (owner)

```
Goal: Sign off Session 3 tracker row — full flow on phone (PWA if possible).
Flow: Create project under Work + sub-project → weekly check-in save → /dashboard glance →
  /projects/tasks (add, zone, defer, promote, complete) → edit project → add link →
  /settings/audit-log?module=projects (task row + soft-delete revert).
Then: check Session 3 smoke box on docs/POS_Projects_Build_Tracker.md and note date in PLAN.md.
```

### Projects — global MYN Now view (future session)

```
Read: docs/MYN_TASKS_DESIGN.md (Future architectural build), AGENTS.md projects inventory,
  src/lib/components/project-task-list.svelte, docs/decisions/047-projects-session-3-myn-tasks-links-audit.md
Goal: Cross-project (and eventually cross-module) unified Now list — reuse task list component.
Phase 0: nullable project_id? nav entry? defer-to-Review automation scope?
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

1. **Library Wave 2** — fixture-first Turabian + essays/article-level citations (see Current focus).
2. **Data safety setup (one-time):** GitHub Action — monthly two-file `pg_dump` → private backup repo/Drive; one test restore to confirm. See Session handoff › Data safety.
3. **Projects — use v1 weekly** (tree check-in + optional `/projects/tasks`). Retrospective / process: central Claude project (see tracker Notes).
4. **Projects backlog (pick one when ready):** status appearance polish · global MYN Now view · optional full phone smoke on tracker.
5. **Library (parallel):** PWA performance (separate chat).
6. **Invoicing:** first real-client send cadence (owner-driven).
