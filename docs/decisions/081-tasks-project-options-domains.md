# 081 — Tasks project options are domain roots

**Date:** 2026-07-10
**Module:** projects
**Tracker session:** ad-hoc (MYN polish)

## Built
- `/tasks` project filter + New/Edit task project select list **domain roots only** (Personal, Education, Work, …) instead of leaf children.
- Filtering by a domain includes tasks on that root **and** all descendants (so Email Inbox under Work still appears when Work is selected).
- Edit sheet still surfaces a task’s current child project if it isn’t a root (email-capture / legacy rows) so the select doesn’t go blank.

## Decided
- Assign and filter at the **domain** level — rejected keeping children in the picker (too long, wrong granularity for MYN).
- Domain filter = subtree (`project_id IN root + descendants`) rather than exact match only — otherwise Work would hide Email Inbox tasks.
- Do not force-migrate child-assigned tasks onto the root on edit; only offer the current child as an extra option until the user reassigns.

## Schema changes
- None

## New components / patterns added
- None — `loadTasks` gained optional `projectIds` for multi-id filter.

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Prior filter was intentionally `parent_id != null` (children only); flipping to roots without subtree filter would have hidden inbound email tasks under Work.

## Carry-forward updates
- [x] components.mdc updated (N/A)
- [x] AGENTS.md inventory updated (N/A)
- [x] new env vars documented (N/A)
- [x] tracker Open Questions updated (N/A)
