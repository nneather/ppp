# 130 — Retire Email Inbox; default + inbound → Personal

**Date:** 2026-07-23
**Module:** projects
**Tracker session:** Ad-hoc

## Built

- Soft-deleted **Email Inbox** project; moved its live tasks to **Personal**.
- Owner `profiles.default_task_project_id` → Personal (New Task default).
- Edge secret `INBOUND_TASK_PROJECT_ID` → Personal UUID (`72de0d93-…`).
- Docs: [supabase/README.md](../../supabase/README.md), AGENTS.md, Edge Function header comment.

## Decided

- Forwarded mail no longer needs a dedicated capture project — land on Personal and re-file when useful.
- Keep Email Inbox row soft-deleted (not hard-deleted) for audit / historical `project_id` references.

## Schema changes

- `20260723190000_retire_email_inbox_default_personal.sql` — DML: refile tasks, soft-delete Email Inbox, set owner default.

## New components / patterns added

- None.

## Open questions surfaced

- None.

## Surprises

- Owner default was already Personal from fall polish settings smoke; migration still forced Personal for clarity.

## Carry-forward updates

- [x] AGENTS.md + supabase README
- [ ] PLAN.md — light touch if committing this session
- [x] new env/secrets — `INBOUND_TASK_PROJECT_ID` value changed (same name)
