# 126 — Fall MYN backlog lock

**Date:** 2026-07-23
**Module:** projects
**Tracker session:** Ad-hoc — triage of [MYN_TASKS_DESIGN.md](../MYN_TASKS_DESIGN.md) “Future” + [099](099-myn-trial-adopted.md) polish candidates

## Built

- None (decision-only). Design doc rewritten to the locked fall scope.

## Decided

- **Keep required `project_id`** — no nullable / orphan tasks. `/tasks` remains the unified list (no `/now` route required).
- **Default project** — preference for what New Task pre-selects when no project filter is active (sheet already accepts `defaultProjectId`).
- **Saved views** — multiple named filters (include / exclude / only-project), not a second task surface.
- **Defer → next Monday** — ship one-click next Chicago Monday → OTH; defer dialog date presets OK. **No** separate OTH review-queue UI.
- **Target Now** — ship visual for `opportunity_now` + `start_date = today`.
- **Weekly guided OTH review mode** — drop.
- **Soft-cap = 50 total** open non-deferred tasks across all zones (not per-zone 5/20). Default: hide lowest priority first, then oldest (`start_date` ASC / reverse FRESH). Always announce when count ≥ 50 (banner / “Showing 50 of N”). Optional Show-all to reveal truncated rows. Classic Linenberger zone caps stay methodology-only.
- **Cross-module source tags + module RLS** — remain parked until a concrete create-from-entity case appears.

## Schema changes

- None in this decision. Fall build may add a profile (or settings) column for default project / saved views — decide in the build session.

## New components / patterns added

- None yet.

## Open questions surfaced

- Persist saved views where? (`profiles` JSON vs small table) — build session.
- Soft-cap “Show all”: session-only toggle vs sticky preference — build session (default off).

## Surprises (read these before the next session)

- Global Now was largely already `/tasks` + project labels; the parked item was over-scoped as nullable FK + cross-module.

## Carry-forward updates

- [x] [MYN_TASKS_DESIGN.md](../MYN_TASKS_DESIGN.md) Future section → Fall polish backlog
- [x] PLAN.md refreshed (session prompt + Next up)
- [ ] components.mdc — N/A until build
- [ ] AGENTS.md inventory — N/A until build
- [ ] new env vars — none
