# Personal Operations System — Projects Module Build Tracker

> **Read these before any session — the tracker assumes they are loaded.**
>
> - `AGENTS.md` — carry-forward inventory, env vars, decision-record template, quality gates
> - `docs/MODULE_KICKOFF_PLAYBOOK.md` — **Phase 0 gates + footgun registry** (mandatory for Session 0)
> - `docs/POS_Projects_Session_0.md` — **prereq**; this tracker is canonical only after Session 0 acceptance
> - `docs/decisions/000-invoicing-retro.md` — RLS helpers, form-action shape
> - `docs/decisions/041-library-module-retro.md` — taxonomy churn, verification cadence, silent failures
> - `.cursor/rules/always.mdc`, `db-changes.mdc`, `sveltekit-routes.mdc`, `components.mdc`, `module-kickoff.mdc`
>
> Standards live in those files; the tracker is the plan.

_Last updated: June 3, 2026 | Module: Projects (3rd) | **Status: Session 0 in progress** — tracker session arc TBD at Session 0 end._

---

## Pre-Session Checklist

_From [MODULE_KICKOFF_PLAYBOOK.md](MODULE_KICKOFF_PLAYBOOK.md) — owner signs off before Session 1._

- [ ] Phase 0 gates complete (see Session 0 doc)
- [ ] `docs/POS_Projects_Session_0.md` acceptance met
- [ ] `docs/decisions/NNN-projects-session-0-audit.md` filed
- [ ] Domain brief + schema section added to `POS_Schema_v1.md` (or linked decision)
- [ ] Viewer seed plan or waiver documented
- [ ] Session 1–N arc drafted below (replace placeholder section)

---

## Session 0 — Schema audit + Phase 0 lock (TBD hours)

_Goal: Lock structure before code. No CRUD until acceptance on Session 0 doc._

| Task | Done | Notes |
|------|:----:|-------|
| Domain brief — entities, workflows, out of scope v1 | ☐ | |
| Schema audit vs baseline — list every new table + RLS | ☐ | No projects tables in baseline today |
| Resolve Open Questions Q1–Q5 on Session 0 doc | ☐ | |
| Draft session arc (Session 1 = vertical slice target) | ☐ | |
| File Session 0 decision record | ☐ | |

**Acceptance:**

- [ ] Phase 0 checklist on Session 0 doc all checked or explicitly waived
- [ ] Open Questions ≤2 unresolved per major entity
- [ ] Owner reviewed this tracker’s session list
- [ ] `npm run check` passes (no code required; docs-only OK)

---

## Session 1+ — TBD after Session 0

_Session 1 will be the first vertical slice (likely primary entity CRUD + permissions module slug `projects`). Arc filled in at end of Session 0._

| Session | Goal | Done |
|---------|------|:----:|
| 1 | _TBD_ | ☐ |
| 2 | _TBD_ | ☐ |

---

## Open Questions — Projects (globals)

| # | Question | Status |
|---|----------|--------|
| 1 | Primary entity + taxonomy | ☐ Session 0 |
| 2 | Invoicing linkage | ☐ Session 0 |
| 3 | Library linkage | ☐ Session 0 |
| 4 | Mobile-first vs desktop-OK v1 | ☐ Session 0 |
| 5 | Hard deadline | ☐ Session 0 |

---

## Notes

- Library module: trip QA signed off [043](decisions/043-library-trip-qa-signoff-projects-handoff.md); Wave 2 August on library tracker.
- When this module ships tables: extend `_PROJECTS_TABLES` (or equivalent) in audit-log UI per [001-audit-log-ui.md](decisions/001-audit-log-ui.md).
- Define `npm run ship-projects` / `ship-projects:apply` when migrations + types + tests exist (mirror `ship-library`).
