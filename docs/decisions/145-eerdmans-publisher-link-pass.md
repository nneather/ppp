# 145 — Eerdmans publisher link / normalize pass

**Date:** 2026-07-24
**Module:** library
**Tracker session:** ad-hoc — follow-up to [131](131-bh-publisher-link-backfill.md) / [133](133-baker-publisher-link-pass.md)

## Built

- Idempotent DML migration `20260724210500_library_eerdmans_publisher_link_pass.sql` (hosted `db push`):
  - Expanded `Eerdmans.aliases` with free-text / OL variants (`W.B. Eerdmans`, `Wm. B. Eerdmans Pub. Co.`, `Eerdmans Publishing Company, William B.`, `William B. Eerdmans`, etc.)
  - Linked **16** unlinked free-text rows → `Eerdmans` / `Grand Rapids, MI`
  - Normalized free-text `publisher` → **`Eerdmans`** on all matching + already-linked rows
  - Location backfill: **13** linked rows that had `publisher_location` NULL → `Grand Rapids, MI`; fixed one dual imprint (`Grand Rapids, Mich; Carlisle, Cumbria`) → `Grand Rapids, MI`
- Post-apply: **36** live books linked to `Eerdmans`, all `publisher = Eerdmans` / `publisher_location = Grand Rapids, MI`; **0** remaining unlinked Eerdmans-ish free-text

## Decided

- Single registry imprint **`Eerdmans`** (already present) — do **not** create a separate `William B. Eerdmans` publisher; variants are abbreviation/style only (unlike Broadman vs B&H).
- **Normalize free-text** to canonical `Eerdmans` (unlike B&H [131], which kept historical Broadman strings). Turabian already prefers linked `canonical_name`; free-text normalize keeps the registry + book form consistent.
- US postal location only: **`Grand Rapids, MI`** even when a co-publish line mentioned Carlisle / Paternoster.

## Schema changes

- `20260724210500_library_eerdmans_publisher_link_pass.sql` — DML only (aliases + books `publisher_id` / `publisher` / `publisher_location`)

## New components / patterns added

- None.

## Open questions surfaced

- *The New Bible Dictionary* ISBN `9780842346672` (Tyndale-looking `08423` prefix) was free-text `Wm. B. Eerdmans Pub. Co.` and is now linked Eerdmans — shelf-verify imprint if citations look wrong.

## Surprises

- No duplicate soft-deleted Eerdmans publisher rows; inventory was free-text drift + missing locations only.
- Migration filename needed a timestamp **after** `20260724193000_series_include_in_citation` or `db push` required `--include-all`.

## Carry-forward updates

- [x] PLAN.md refreshed
- [ ] components.mdc — N/A
- [ ] AGENTS.md — N/A
- [ ] new env vars documented — N/A
- [x] `npm run check` — N/A (DML-only; no app/types change)
