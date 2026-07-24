# 138 — Fall semester priorities (pre–Aug 31)

**Date:** 2026-07-24
**Module:** cross-module (planning)
**Tracker session:** Ad-hoc — priorities refresh + session prompts

## Built

- Refreshed personal [`context/current-priorities.md`](../../../context/current-priorities.md) (was stale since 2026-06-06) for the Aug 9 STL return → Aug 31 semester window.
- PLAN.md › Next up reordered: **classwork Session 0** and **ppp MCP read-only v1** ahead of optional polish; Madison library shelf work stays August-gated.
- Two copy-paste session prompts added to PLAN.md (MCP v1; classwork Session 0).

## Decided

- **August theme = semester readiness**, not more greenfield modules beyond classwork + MCP.
- **Classwork is a real module** (or Education-scoped entity set) with **due dates** — do not overload MYN `project_tasks` (no `due_date` by design — [MYN_TASKS_DESIGN.md](../MYN_TASKS_DESIGN.md), [047](047-projects-session-3-myn-tasks-links-audit.md)).
- **MCP v1 is read-only** first (tasks Now, classwork due-soon, library search / citation helpers, upcoming sermons). Write tools deferred until the read surface is trusted.
- **Defer** PWA icons, OCR matrix (unless next batch touch), Global Now, viewer readiness, paper-scoped citation registry — protect capacity through Aug 31.
- Owner still wants both items Parker named: MCP for chat query + classwork structure for deadlines/papers.

## Schema changes

- None this session (planning only).

## New components / patterns added

- None in code.

## Open questions surfaced

- Classwork Session 0 must lock: courses vs assignments vs paper drafts; relationship to Education domain projects; dashboard vs dedicated `/classwork` route; whether papers link to library bibliography sessions.
- MCP Session 0/v1 must lock: stdio local vs remote host; auth (owner JWT / local-only); which loaders to reuse vs raw SQL; Cursor MCP config path.

## Surprises (read these before the next session)

- Personal priorities file had drifted ~7 weeks; HeLOS June focus bullets were misleading as “current.” Prefer PLAN.md + this file + latest decisions for ppp; refresh `current-priorities.md` whenever the ranked list changes.

## Carry-forward updates

- [x] PLAN.md refreshed (Next up + session prompts)
- [x] `context/current-priorities.md` refreshed
- [ ] components.mdc — n/a
- [ ] AGENTS.md inventory — n/a until modules exist
- [ ] new env vars — none yet (MCP will document when built)
- [ ] tracker Open Questions — create classwork tracker in Session 0
