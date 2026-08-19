# 206 — Outlook-style right Now pane

**Date:** 2026-08-19
**Module:** projects
**Tracker session:** Ad-hoc — right To-Do Bar + collapse

## Built
- **Moved desktop Now pane** from between module nav and content to the **right** of `<main>` (`border-l`) — Outlook MYN To-Do Bar layout: nav | page | tasks.
- **Collapsible** like the left nav: expanded `w-80`, collapsed `w-[4.5rem]`, `transition-[width]`, preference in `localStorage` (`ppp_tasks_collapsed`).
- **Collapsed strip:** expand control, New (opens create sheet), open-Now count. Fetch stays mounted so expand/New keep project options.
- Still hidden on `/tasks`; mobile unchanged. Same `GET /tasks/now.json` + `actionPrefix="/tasks"` from [205](205-desktop-now-task-rail.md).

## Decided
- **Right pane, not left** — classic Outlook To-Do Bar; [205](205-desktop-now-task-rail.md) left placement was wrong for the MYN metaphor.
- **Independent collapse** from module nav — mid-width laptops can shrink either chrome alone.
- **Toggle lives in the rail header** — layout owns width + storage; rail owns the control so it stays next to Now / New.

## Schema changes
- None.

## New components / patterns added
- [`desktop-task-rail.svelte`](../../src/lib/components/desktop-task-rail.svelte) — `bind:collapsed`; collapsed icon strip.
- Root layout: `TASKS_STORAGE_KEY` + aside after main column.

## Open questions surfaced
- None.

## Surprises (read these before the next session)
- None beyond [205](205-desktop-now-task-rail.md) (layout form actions, dynamic import).

## Carry-forward updates
- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] PLAN.md refreshed
