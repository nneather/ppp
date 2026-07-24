# 139 — Lightweight CRM on fall priority list

**Date:** 2026-07-24
**Module:** contacts / CRM (planning)
**Tracker session:** Ad-hoc — addendum to [138](138-fall-semester-priorities.md)

## Built

- Added **lightweight CRM** to fall priorities: people tracker for meet cadence + seasonal lists (Christmas cards); eventual ministry mailing list. Durable in `context/current-priorities.md`, PLAN.md Next up + Session 0 prompt.
- Hard constraint noted for Session 0: **do not reuse library `people`** (authors) — separate contacts entity / module.

## Decided

- **In scope for fall thin v1:** contacts + how-often-to-meet (cadence / last-met / next-due) + flags for seasonal outreach (e.g. Christmas card). MCP-readable (“who should I meet this week?”).
- **Explicitly later:** full ministry mailing-list send pipeline (Resend campaigns, segments, unsubscribe compliance) — design for it in Phase 0 (email fields, list flags) but do not build send in v1.
- **Ranking:** after classwork Session 0 + MCP read-only v1; before or interleaved with Madison shelf QA as capacity allows. Christmas-card utility implies thin v1 useful by **~Thanksgiving**, not only Aug 31.
- **Taxonomy:** new module (working name `contacts` / CRM) — never overload `people` (library authors) or invoicing `clients`.

## Schema changes

- None this session.

## New components / patterns added

- None in code.

## Open questions surfaced

- Cadence model: interval days vs MYN-like start_date vs explicit `next_touch_on`?
- Households / couples for Christmas cards (one row vs two + household)?
- Optional link from contact → library person or invoicing client (FK later vs never)?
- Module permission key name (`contacts` vs `crm` vs `ministry`)?

## Surprises (read these before the next session)

- Library already owns the table name `people` — Session 0 must pick a non-colliding table (`contacts`, `relationships`, etc.) up front.

## Carry-forward updates

- [x] PLAN.md + current-priorities.md + goals.md
- [ ] Tracker created in CRM Session 0
- [ ] components.mdc / AGENTS.md — when module exists
