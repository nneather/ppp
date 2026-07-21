# 105 — Solo git/ship agent guidance + main protection close-out

**Date:** 2026-07-21
**Module:** cross-module (repo infra)
**Tracker session:** Ad-hoc — branch protection follow-up

## Built

- Documented solo **Git / ship** rules in [AGENTS.md](../../AGENTS.md) and [.cursor/rules/workflow.mdc](../../.cursor/rules/workflow.mdc): branch protection ≠ PR theater; no invented PRs; no piling unrelated sessions onto one long-lived branch; no unprompted `reset --hard` to “fix” a protected push.

## Decided

- **`main` branch protection adopted** (owner): require status check `check-and-test`, no force-push / no deletions, include administrators. Reviews / “must use PRs” stay **off** — solo personal project.
- **Problem was real** ([097](097-vercel-deploy-ci-build-gate.md)): red CI still reached Vercel before protection. Remedy is required checks, not a PR culture.
- **Agents must not invent PRs** when a push to `main` is blocked. Prefer: copy-paste commit message for Parker; if a branch is needed for CI, use a **short-lived, session-named** branch — never reuse an open feature branch for unrelated work.
- **Trigger for this note:** Speed Insights work landed on [PR #1](https://github.com/nneather/ppp/pull/1) only because an earlier skill chat opened that PR after hitting protection, and later chats inherited `library-add-books-skill`. The Insights chat did not create the PR.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- **Owner (optional):** After the next Production deploy from a green `check-and-test`, glance Vercel Ready once — smoke from [097](097-vercel-deploy-ci-build-gate.md). Not blocking.

## Surprises (read these before the next session)

- Cursor’s commit-and-push UI action pins the **current** branch; if that branch is leftover from another session, unrelated commits pile onto the same PR.
- `git reset --hard origin/main` after a blocked `main` push is dangerous when other chats have WIP on the same tree.

## Carry-forward updates

- [x] AGENTS.md Git / ship section
- [x] workflow.mdc Git / ship section
- [x] [097](097-vercel-deploy-ci-build-gate.md) owner checkbox for branch protection
- [x] PLAN.md Next up item removed
