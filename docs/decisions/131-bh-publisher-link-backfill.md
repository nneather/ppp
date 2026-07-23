# 131 — B&H free-text publisher link backfill

**Date:** 2026-07-23
**Module:** library
**Tracker session:** ad-hoc — follow-up to [127](127-ivp-publisher-location-backfill.md) open question

## Built

- Idempotent DML migration `20260723202803_library_bh_publisher_link_backfill.sql` (hosted `db push`):
  - Linked **25** unlinked free-text rows → `B&H Academic` / `Nashville, TN`: `B&H Academic`, `B&H Publishing Group`, `Broadman & Holman Publishers`, `Broadman Press`, `Holman Reference`
  - Fixed **2** EGGNT rows (*Ephesians*, *Matthew*) whose free-text was `B&H Academic` but `publisher_id` pointed at **Logos / Faithlife**
  - Expanded `B&H Academic.aliases` for OL / future free-text matching
- Post-apply: **28** live books linked to `B&H Academic`, all `publisher_location = Nashville, TN`; **0** remaining unlinked B&H / Broadman / Holman free-text

## Decided

- Single registry imprint **`B&H Academic`** for historical Broadman Press / Broadman & Holman / Holman Reference / B&H Publishing Group — no separate Broadman Press publisher (rejects the “split historical Broadman Press” option from [127](127-ivp-publisher-location-backfill.md)).
- Keep free-text imprint strings on `books.publisher` (Turabian prefers linked `canonical_name`); only set `publisher_id` + location.
- **Exclude** `Lifeway Christian Resources` (*Praying with Paul*, ISBN `9780801097102`) — looks Baker Academic, not B&H.

## Schema changes

- `20260723202803_library_bh_publisher_link_backfill.sql` — DML only (publishers aliases + books `publisher_id` / `publisher_location`)

## New components / patterns added

- None.

## Open questions surfaced

- ~~*Praying with Paul* still unlinked as Lifeway; verify on shelf / remint to Baker if confirmed.~~ — **done** ([133](133-baker-publisher-link-pass.md)).

## Surprises

- Two EGGNT vols were already “B&H Academic” in free-text but FK’d to Logos — linking pass had to include wrong-`publisher_id` repair, not only `publisher_id IS NULL`.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars documented — N/A
- [x] `npm run check` — N/A (DML-only; no app/types change)
