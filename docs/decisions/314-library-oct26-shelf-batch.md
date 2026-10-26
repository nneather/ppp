# 314 — Library Oct 26 shelf batch

**Date:** 2026-10-26
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261026184303_library_oct26_shelf_batch.sql` (hosted push). Five standalone books. Three new people.
  - *Resisting Therapy Culture* — Matthew Loftus. Subtitle: The Dangers of Pop Psychology and How the Church Can Respond. IVP, Downers Grove, IL, 2026, `9781514012680`. Culture. Unread.
  - *Stories of Your Life and Others* — Ted Chiang. Vintage paperback, New York, 2016, `9781101972120`. Literature. Unread.
  - *When the Kings Come Marching In* — Richard J. Mouw. Subtitle: Isaiah and the New Jerusalem. Edition `Revised`. Eerdmans, Grand Rapids, MI, 2002, original year 1983, `9780802839961`. Culture. Unread. No Isaiah coverage.
  - *Jesus Through the Eyes of Women* — Rebecca McLaughlin (existing person). Subtitle: How the First Female Disciples Help Us Know and Love the Lord. The Gospel Coalition, Indianapolis, IN, 2022, `9781956593075`. Gospels and Jesus. Unread.
  - *Nelson's Minister's Manual* — no author. Edition `NKJV`. Thomas Nelson, Nashville, TN, 2003, `9780785250890`. Pastoral Ministry. Reading status `reference`.

## Decided

- Chiang is the 2016 Vintage paperback, not the 2002 Tor hardcover (owner 1).
- Loftus and Mouw are Culture. The manual is Pastoral Ministry and `reference`, not unread (owner 2). McLaughlin is Gospels and Jesus.
- No study-set member rows (owner 3). None of these match a commentary or language-tool rule.
- Subtitles live in `books.subtitle`, matching the Oct 7 shelf batch. Titles stay the short form.
- IVP, Eerdmans, and Thomas Nelson link to existing publisher rows. Vintage and The Gospel Coalition stay free text. No new registry rows.
- `needs_review` false. Work type monograph. Language English.
- The manual is authorless. The existing Thomas Nelson person is not attached.
- Matthew Loftus is a new person. The last-name-only Loftus row (German grammar) is untouched.

## Schema changes

- `20261026184303_library_oct26_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- The publisher registry canonical for this imprint is `IVP`, so the Loftus row links as IVP rather than the longer “InterVarsity Press” string.
- Mouw’s `author_display` is “Richard J. Mouw” from middle initial `J` (no period stored).
- No commentary coverage. Mouw is a culture essay on Isaiah 60, not a commentary.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] No Commentary rows, so coverage arrays are correctly empty
- [x] No `resource_set_members` rows
