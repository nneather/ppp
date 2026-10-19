# 260 — Muraoka’s Septuagint lexicon

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261019253000_library_muraoka_gels.sql` (hosted push).
- *A Greek-English Lexicon of the Septuagint* — T. Muraoka (existing person). Peeters, Louvain, 2009 `9789042922488`. Greek Language Tools, `reading_status` reference, `needs_review` false.
- Included on Septuagint studies (`bibliographical` true). Dismissed from NT language tools so the Greek Language Tools genre rule does not list it there.

## Decided

- This is the 2009 complete lexicon (ISBN `9789042922488`), not the 1993 Twelve Prophets volume or the 2002 Pentateuch-and-Twelve-Prophets volume. Those earlier books have different subtitles, so `edition` stays empty and `original_year` stays null.
- Same title as Lust, Eynikel, and Hauspie. The insert is keyed by ISBN, and the author line distinguishes the two rows. No series, so they do not roll up.
- Reuse `T.` / `Muraoka`. No second person row for Takamitsu.
- `work_type` is `monograph`, matching the LEH row. Greek Language Tools still cites as a single-author reference work, and monograph keeps the detail page from asking for an editor.
- Peeters stays free-text unless a `publishers` row already exists. Place is Louvain, the form on the 2009 bibliographic record.

## Schema changes

- `20261019253000_library_muraoka_gels.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- A title-only `WHERE NOT EXISTS` would have skipped this book, because LEH already uses that title with `series_id` null.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] tracker — ad-hoc; no session to tick
