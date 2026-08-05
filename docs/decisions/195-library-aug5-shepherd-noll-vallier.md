# 195 — Library Aug 5 shelf batch (Shepherd / Noll / Vallier)

**Date:** 2026-08-05
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260805214700_library_aug5_shepherd_noll_vallier.sql` (hosted push):
  - Michael B. Shepherd, *How Did They Read the Prophets?: Early Jewish and Christian Interpretations* (Eerdmans 2025, `9780802885418`) — genre **Prophets**.
  - Mark A. Noll, *The Scandal of the Evangelical Mind* (Eerdmans 1994 hardcover, `9780802837158`) — genre **Church History**; reused existing Noll person.
  - Kevin Vallier, *All the Kingdoms of the World: On Radical Religious Alternatives to Liberalism* (OUP 2023, `9780197611371`) — genre **Politics and Policy**.
- New people: Shepherd, Vallier. All three standalone (`series_id` null), `needs_review = false`, `reading_status = unread`.

## Decided
- Noll: 1994 hardcover ISBN (not 1995 paperback / 2022 revised).
- Shepherd: full subtitle retained; genre Prophets (reception/exegesis of prophetic lit — not Commentary).
- Vallier: OUP location `Oxford` to match sibling OUP rows; Politics and Policy (not Philosophy).
- No bible coverage (none are Commentary).

## Schema changes
- `20260805214700_library_aug5_shepherd_noll_vallier.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- None

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
