# 173 — Canvas classwork import (deferred; smoke OK)

**Date:** 2026-07-24
**Module:** classwork
**Tracker session:** Ad-hoc exploration (post Session 2)

## Built

- Owner smoked Covenant Canvas REST API with a personal access token:
  - `GET /api/v1/users/self` → Parker (id 5812)
  - `GET /api/v1/courses?enrollment_state=active` → active courses incl. ST350, OT330, Ethics, etc.
  - `GET /api/v1/courses/3492/assignments` → dated published rows with `due_at` (ISO UTC)
- No code shipped — feasibility only.

## Decided

- **Canvas is viable** for a one-shot (or occasional) import into `courses` / `assignments`. Not a live sync.
- **Token workflow:** school ~1-month access-token limit → **mint a fresh token at semester start** (and again only if a mid-semester re-pull is needed). No OAuth/refresh in v1.
- **When to build:** late August 2026, after first Fall syllabi/bibliographies land — not now (Contacts Session 0 stays ahead on fall priority).
- **First-weeks churn expected:** class drops/adds and professor due-date reloads. Import must be **preview → confirm**, idempotent on Canvas assignment id (store external id or match on course+title), and safe to re-run (update `due_date` / soft-skip done rows). Manual `/classwork` edits remain source of truth between pulls.
- **Mapping notes from ST350 sample:**
  - `due_at` → Chicago civil `due_date` (date only; A2 time-of-day still deferred)
  - Mix of graded reflections, 0-pt discussion groups, Participation, Final Exam — import should default kind heuristically or `other`, with preview checkboxes to skip noise (e.g. Participation, cross-listed ST370 exam sitting in ST350)
  - Course name/code like `Spirit, Church & Last Things (SP-26 ST350)` / `SP-26 ST350` → parse term label + code

## Schema changes

- None yet. Import session may add nullable `canvas_assignment_id` (or generic `external_id`) for idempotent re-pull — lock then.

## New components / patterns added

- None.

## Open questions surfaced

- Persist Canvas course/assignment ids on ppp rows? (recommended for re-pull; decide in build session)
- Include 0-point discussion groups by default or opt-in?
- Host URL + token only in `.env.local` (`CANVAS_HOST`, `CANVAS_TOKEN`) — never client.

## Surprises (read these before the next session)

- ST350 assignment list includes **ST370 Final Exam** (cross-list / shared shell) — preview must allow skip.
- `users/self` returned `email: null` — fine for import; do not rely on email from Canvas.
- Token max life ~1 month is an institutional limit, not an API rate limit.

## Carry-forward updates

- [x] Tracker backlog + PLAN August reminder
- [ ] Build session prompt when syllabi land (see PLAN › Wait for Madison / August)
