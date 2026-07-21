# 106 — Admin bypass on main protection (solo push)

**Date:** 2026-07-21
**Module:** cross-module (repo infra)
**Tracker session:** Ad-hoc — follow-up to [105](105-solo-git-ship-agent-guidance.md)

## Built

- Updated solo Git / ship wording in [AGENTS.md](../../AGENTS.md) and [.cursor/rules/workflow.mdc](../../.cursor/rules/workflow.mdc) for admin bypass.
- Amended notes on [097](097-vercel-deploy-ci-build-gate.md) / [105](105-solo-git-ship-agent-guidance.md).

## Decided

- **Owner:** Turned off GitHub **Do not allow bypassing the above settings** / Include administrators on `main` (`enforce_admins: false`). Confirmed via API.
- **Still on:** required status check `check-and-test`, no force-push, no deletions, no required reviews.
- **Why:** With admins enforced, every land on `main` needed a side branch + PR just to get CI green — too much ceremony for a solo personal repo (PRs #2–#3). Required checks remain the default gate; Parker (admin) may push straight to `main` when he wants.
- **Agents:** Still do **not** invent PRs. Prefer work on `main`; when Parker asks to commit/push, push to `main` is allowed. Open a PR only if he asks, or if a non-admin path is blocked.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises (read these before the next session)

- Admin bypass does **not** disable the required check for PR merges / non-admin pushes — only the repo admin can skip it on a direct push to `main`.

## Carry-forward updates

- [x] AGENTS.md + workflow.mdc updated
- [x] 097 / 105 cross-notes
- [x] PLAN.md refreshed
