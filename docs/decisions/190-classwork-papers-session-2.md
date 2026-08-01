# 190 — Classwork papers Session 2 (research groups UI)

**Date:** 2026-08-01
**Module:** classwork (papers / research groups)
**Tracker session:** Papers Session 2

## Built

- Research groups UI on `/classwork/papers/[id]` — no schema change (`paper_research_groups` shipped in `20260801120600`):
  - **Group CRUD:** collapsible "New research group" inline form; per-group header with rename (inline form), move up/down (reorder), and confirm-gated delete.
  - **Assign/move sources:** compact native `<select>` on each source row (owner-only, hidden when the paper has no groups) posting `?/setPaperSourceGroup`; picking "Ungrouped" clears the group.
  - **Bucketed rendering:** Ungrouped bucket first (hidden when empty), then named groups by `sort_order`; empty groups show a hint; zero groups = flat list identical to Session 1. Compiled bibliography unchanged — still flat, ignores groups.
- `groupPaperSources` bucket helper (client-safe, generic over `{ groupId }`) in `src/lib/classwork/paper-sources.ts` + `PaperGroupView`; 5 unit tests.
- `loadPaperGroups` in `paper-loaders.ts`; five actions in `paper-actions.ts`: `createPaperGroupAction`, `renamePaperGroupAction`, `reorderPaperGroupsAction`, `softDeletePaperGroupAction`, `setPaperSourceGroupAction`.
- `<PaperGroupHeader>` component (`src/lib/components/paper-group-header.svelte`).

## Decided

- **G1 resolved — soft-deleting a group nulls `paper_sources.group_id`** (the standing tracker/PLAN recommendation): sources survive ungrouped; delete is never blocked. Null-out runs **before** the group soft-delete so a partial failure leaves sources ungrouped with the group still live (retryable), never orphaned pointers. Rejected block-while-attached (friction with zero payoff — the sources are the valuable thing, the label is not).
- **Ungrouped bucket renders first** — it is the inbox: newly attached sources land there, directly under the add-source panel, then get filed into groups. Rejected ungrouped-last (new attachments would land below the fold on a long grouped list).
- **Reorder = ordered-id-array rewrite** (`sort_order = index`), the `reorderProjectLinks` precedent; UI is up/down chevrons that swap and submit the full order — no drag-and-drop dependency for a handful of groups.
- **Group move on the row is a native `<select>`**, not a menu component — one control, mobile-friendly, auto-submits on change.
- **Defensive bucket fallback:** a source whose `group_id` is not in the live group list renders in Ungrouped instead of disappearing (same failure class as the 189 orphan-source finding).
- **Duplicate group names allowed** — no schema constraint, not worth blocking for a per-paper label set.

## Schema changes

- None. (`paper_research_groups` + `paper_sources.group_id` shipped in Session 1; audit whitelist already covers the table.)

## New components / patterns added

- `src/lib/components/paper-group-header.svelte` — group section header: name + count, inline rename form, move up/down callbacks, delete callback.
- `groupPaperSources` / `PaperGroupView` in `src/lib/classwork/paper-sources.ts` — pure bucket helper; tests `__tests__/paper-sources.test.ts`.

## Open questions surfaced

- None — G1 was the last papers open question.

## Surprises (read these before the next session)

- None of substance. The browser-agent smoke needed three prompts to run all 14 steps (it stopped early twice); the cleanup step (deleting the smoke paper from prod) is the part worth re-checking whenever a smoke is delegated.

## Verification

- `npm run check` 0 errors; `npm run test` 430 passed (5 new `groupPaperSources` tests).
- Mobile smoke (390×844, browser agent, 14/14 pass): create paper + 3 sources; create 2 groups; move sources between groups; Ungrouped-first ordering; rename; reorder via chevrons; **G1 delete → sources fall back to Ungrouped**; zero-groups flat-list regression (no headers, no selects); no console errors; no layout breakage; smoke paper deleted at the end.
- `audit_log` rows confirmed for `paper_research_groups` INSERT/UPDATE and `paper_sources` UPDATE (group moves + G1 null-out), all with `changed_by` set.
- Viewer RLS: same classwork policies; solo waiver unchanged.

## Carry-forward updates

- [x] Tracker Papers Session 2 ticked (+ G1 answered)
- [x] PLAN.md refreshed (module row, Recent decisions, prompt removed, repo gate)
- [x] AGENTS.md inventory — group helpers noted on classwork entry
- [x] components.mdc — `<PaperGroupHeader>` added; source-row entry updated
- [x] new env vars — none
