# 213 — Contacts frequency labels (Quarterly / Semester / Annual)

**Date:** 2026-08-24
**Module:** contacts / CRM
**Tracker session:** Ad-hoc after [212](212-contacts-due-integrity.md)

## Built

- Confirmed Sheet1 import frequencies landed mixed on hosted contacts (not a uniform quarterly backfill): 76 annual / 45 semester (`semiannual`) / 36 common / 30 quarterly / 3 none. Sheet letters A/S/Q/C/N match.
- Display copy: `semiannual` now labels **Semester** (was Biannual). List, due strip, dashboard, form picker, Skip errors, Lists-tab hint.
- MCP `list_contacts_due` / `search_contacts` emit `frequency` + `frequency_label`; dropped leftover `effective_cadence_days` (null `cadence_days` was falling back to 90 = “3 months” for everyone, including semester/annual people).
- `parseFrequency` / sheet import accept `Semester` (and Quarterly/Annual words) in addition to C/Q/S/A/N.

## Decided

- Keep storage enum `semiannual` (sheet `S`, H1/H2 periods). Only the user-facing word changes to Semester — no migration.
- Do not re-import; data was already correct.

## Schema changes

- None.

## New components / patterns added

- None.

## Open questions surfaced

- Cursor’s running `ppp` MCP process can still serve the [180] rolling payload until the MCP client is reloaded ([212] surprise).

## Surprises (read these before the next session)

- Live MCP `search_contacts` for Benjamin Thomas (DB `semiannual`) returned `effective_cadence_days: 90` and no frequency — the 90-day profile/app default, not the sheet letter.

## Carry-forward updates

- [x] components.mdc — frequency labels already on contact sheet row
- [x] AGENTS.md inventory — Semester label note
- [ ] new env vars — none
- [x] tracker session row
