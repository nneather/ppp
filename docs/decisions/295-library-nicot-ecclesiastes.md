# 295 — NICOT Ecclesiastes, 2nd ed.

**Date:** 2026-10-23
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261023215000_library_nicot_ecclesiastes_longman.sql` (hosted push).
- *The Book of Ecclesiastes*, 2nd ed. — Tremper Longman III (existing person). NICOT, Eerdmans, Grand Rapids, MI, 2026, ISBN `9780802879059`. Commentary, monograph, English, reading status reference, `needs_review` false.
- Coverage: Ecclesiastes. Lands on **Commentaries: Ecclesiastes** by the bible-book rule. No member row.

## Decided

- Shelf copy is the **2026 2nd ed.** (`9780802879059`, edition `2nd ed.`), not the 1998 1st ed. (`9780802823663`).
- Title stays *The Book of Ecclesiastes*, matching other NICOT rows (*The Book of Job*, *The Book of Leviticus*). Edition lives in `edition`. `volume_number` stays null, same as the other NICOT volumes. `original_year` stays null.
- Reuse the existing person (`Tremper` / `Longman` / suffix `III`). Link the existing Eerdmans publisher row. No new series.

## Schema changes

- `20261023215000_library_nicot_ecclesiastes_longman.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- Eerdmans published a 2nd edition on 2026-02-26. The 1998 volume is a different ISBN. A later 1st-ed insert must key on edition or ISBN; title + NICOT alone would collide with this row.
- `author_display` is `Tremper Longman` (suffix omitted), same as his other rows. The person row still has suffix `III`.
- Decision number 294 was already taken by the sermon commentary shelf. This shelf add is 295.

## Carry-forward updates

- [x] components.mdc — no new component
- [x] AGENTS.md — no new helper
- [x] new env vars — none
- [x] tracker — ad-hoc; no session to tick
