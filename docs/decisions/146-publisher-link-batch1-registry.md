# 146 — Publisher link batch 1 (registry fastest wins)

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — follow-up to [145](145-eerdmans-publisher-link-pass.md)

## Built

- Idempotent DML migration `20260724212000_library_publisher_link_batch1_registry.sql` (hosted `db push`):
  - **Hendrickson** — 43 linked / Peabody, MA (incl. 3 name variants + DBG co-publish free-text)
  - **Crossway** — 35 / Wheaton, IL
  - **Zondervan** — 36 / Grand Rapids, MI (incl. `Zondervan Pub. House`, Youth Specialties; fixed `Mich` / mistaken `Downers Grove, Ill`)
  - **Zondervan Academic** — 10 / Grand Rapids, MI
  - **P&R Publishing** — 22 / Phillipsburg, NJ (incl. `P&R Pub.`, Presbyterian and Reformed Pub. Co.)
  - **Westminster John Knox** — 11 / Louisville, KY (historical Westminster Press + John Knox Press folded in)
- Expanded aliases on each registry row for OL / future matching
- Left Brilliance Audio co-labels alone

## Decided

- Fold historical **Westminster Press** / **John Knox Press** into **WJK** (same pattern as Broadman → B&H).
- Fold **Zondervan/Youth Specialties** into **Zondervan**.
- Normalize free-text to each registry `canonical_name` (Eerdmans-style, not B&H keep-historical).

## Schema changes

- `20260724212000_library_publisher_link_batch1_registry.sql` — DML only

## Open questions surfaced

- *Romans* was Zondervan with `Downers Grove, Ill` location — location corrected; shelf-verify imprint if it looks IVP.

## Surprises

- None beyond the one Downers Grove Zondervan row.

## Carry-forward updates

- [x] PLAN.md refreshed
- [x] `npm run check` — N/A (DML-only)
