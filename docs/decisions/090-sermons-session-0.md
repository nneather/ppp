# 090 — Sermons Session 0 (Phase 0 structure lock)

**Date:** 2026-07-17
**Module:** sermons
**Tracker session:** Session 0

## Built

- Phase 0 structure lock for a standalone Sermons module (`/sermons`).
- Tracker: [POS_Sermons_Build_Tracker.md](../POS_Sermons_Build_Tracker.md).

## Decided

- **Standalone module** — top-level nav, not under Projects. Preaching history is a durable life log, not weekly project ops.
- **Occasion type on the sermon** — `context_type` ∈ `church` | `parachurch` | `academic` (C/P/A). Venues have no type column.
- **Draft-friendly** — only `preached_on` is required; venue, context, topic, passage, notes all nullable.
- **Dual passage model** — `passage_display` (human string) + child `sermon_passages` (structured `bible_book` + chapter/verse null-overload matching library scripture semantics).
- **Library hook** — deep-link to existing `/library/search-passage`; no FK into `scripture_references`.
- **Form delivery** — Sheet for create/edit (~8 fields + compact passage rows).
- **Viewer** — owner-only writes v1; SELECT pre-wired via `app_has_module_read('sermons')`. Viewer write waived.
- **Import** — one-shot seed of Parker’s preaching history in the v1 migration (not a recurring CSV importer).

## Schema changes

- None in Session 0 (Session 1 ships `ppp_sermons_v1`).

## New components / patterns added

- None yet.

## Open questions surfaced

- None blocking Session 1 (≤2 per entity satisfied on tracker).

## Surprises (read these before the next session)

- `user_permissions.module` is free TEXT (no CHECK) — add `sermons` to the permissions UI slug list only.
- Mobile tab bar already has six items; Sermons makes seven — acceptable for v1.

## Carry-forward updates

- [x] Tracker filed
- [ ] components.mdc updated (Session 1)
- [ ] AGENTS.md inventory updated (Session 1)
- [ ] PLAN.md refreshed (Session 1)
- [ ] new env vars documented — none
