# 264 — Girdlestone, Synonyms of the Old Testament

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261019270000_library_girdlestone_ot_synonyms.sql` (hosted push).
- *Synonyms of the Old Testament* — Robert B. Girdlestone (new person, middle initial `B.`). Eerdmans, Grand Rapids, MI, 1981, `original_year` 1897, ISBN `9780802815484`. Hebrew Language Tools, monograph, `reading_status` reference, `needs_review` false. No series. No Bible-book coverage.

## Decided

- Match the shelved *Synonyms of the New Testament* (Richard C. Trench): short title, subtitle empty, middle initial with a period, no series, monograph, reference, not flagged for review.
- Parker’s copy facts stand: Eerdmans, 1981, reproduction of 1897. Typos only were corrected (`Synyonyms`, `TEstament`).
- ISBN `9780802815484` is the Eerdmans photo-reprint of that 1897 second edition (checksum ok). Registries date the ISBN’s first issue 1948; the copy year stays 1981. This is not the 1983 Baker third edition (`9780801037894`, Donald R. White).
- Genre is Hebrew Language Tools, the Old Testament counterpart of Trench’s Greek Language Tools. `work_type` stays monograph, same as Trench, so the detail page does not ask for an editor.
- No series row. Trench’s book also has `series_id` null, and no printed series name turned up. Both stay standalone rather than inventing a series.
- Linked the existing Eerdmans publisher (`Grand Rapids, MI`).

## Schema changes

- `20261019270000_library_girdlestone_ot_synonyms.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None. If a series name is printed on the spine, attach both synonym books to it.

## Surprises (read these before the next session)

- The Trench row is the 1854 Blakeman & Mason copy (ISBN `9780801088902`), not the Eerdmans companion (`9780802815200`). Same catalog shape; different physical edition.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] tracker — ad-hoc; no session to tick
