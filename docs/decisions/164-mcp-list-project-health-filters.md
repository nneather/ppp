# 164 — MCP list_project_health root + changed_only filters

**Date:** 2026-07-24
**Module:** MCP / projects
**Tracker session:** ad-hoc (Monday-protocol week-ahead)

## Built

- Extended `list_project_health` with optional `root` (project id or name → that node + descendants via `collectDescendantIds`) and `changed_only` (keep rows where `health_status != previous_health`, both non-null).
- Filter order when both passed: root subtree, then WoW change.
- Default (neither param) unchanged — full non-done/archived list.
- Shared resolver [`src/lib/mcp/project.ts`](../../src/lib/mcp/project.ts) (exact UUID / name exact → unique prefix → unique substring; suggestions on miss).
- Smoke exercises Education subtree + `changed_only`; unit tests for resolve + delta helper.

## Decided

- **Reuse `loadLatestHealth.previous`** for WoW — no new query. Rows with null previous (first check-in) are not "changed."
- **Name resolve mirrors courses** — ambiguous names return error + suggestions rather than guessing.
- **Response shape unchanged** — still `{ count, projects: [...] }`; unknown root returns `{ error, suggestions }` like other MCP resolvers.

## Schema changes

- None.

## New components / patterns added

- `src/lib/mcp/project.ts` — `resolveProject` / `projectSuggestions` / `healthChangedThisWeek`.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Prod smoke 2026-07-24: `root=Education` → Education + Summer Greek/Hebrew/Reading/Writing (5). `changed_only` included Summer Hebrew watch→serious, Summer Greek satisfactory→watch (plus Church Plant Proposals, Education, Summer Writing).

## Carry-forward updates

- [x] components.mdc — n/a
- [x] AGENTS.md inventory updated
- [x] new env vars documented — n/a
- [x] PLAN.md refreshed
