# 207 — Library Aug 24 shelf batch (commentaries + LOA)

**Date:** 2026-08-24
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migrations `20260824143000_library_aug24_shelf_batch.sql` + `20260824144500_library_aug24_wright_name_parts.sql` (hosted push):
  - **New series:** `LOA` (Library of America).
  - **Commentaries (insert):** REC Doriani *1 Peter*; WBC Craigie *Psalms 1-50* (19), Allen *Psalms 101-150* (21), Smalley *1, 2, 3 John* (51), Martin *James* (48) — Word / Waco originals; TOTC Longman *Psalms* (15); ACCS Wright (ed) *Proverbs, Ecclesiastes, Song of Solomon* (9); PNTC Ciampa/Rosner *The First Letter to the Corinthians*; BECNT Moo *Galatians*; BECNT Köstenberger *John*.
  - **LOA (insert):** *American Sermons* vol 108 (Warner ed, Homiletics); Washington *Writings* 91; Jefferson *Writings* 17; Marshall *Writings* 198.
  - **LOA (update, same ids):** existing Lincoln *Speeches and Writings* 1832–1858 and 1859–1865 → series `LOA` vols 45/46, publisher Library of America, ISBN-13; Fehrenbacher editor rows added.
  - **Coverage verified** on every Commentary row.

## Decided
- WBC = original Word / Waco printings, not Nelson/Zondervan reprints (Craigie 1983 only, not Tate-revised).
- ACCS IX = 2005 hardcover `9780830814794` (not 2021 reprint); volume arabic `9` to match siblings.
- American Sermons genre **Homiletics** (other sermon collections), not Literature/History.
- Create `LOA` series and attach Washington / Jefferson / Marshall / Lincoln writings + American Sermons. Existing *Reporting World War II* LOA copies left unattached (not in this confirm).
- Lincoln vols already in catalog — UPDATE rather than INSERT. 1853 Jefferson *Writings* (J. C. Riker) left as a separate standalone row.
- `needs_review = false`. PNTC includes Rosner as co-author.

## Schema changes
- `20260824143000_library_aug24_shelf_batch.sql` — DML only
- `20260824144500_library_aug24_wright_name_parts.sql` — DML only (name-parts remint)

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- `library_compute_author_display` initials the first character of `middle_name`, so `J.` + `Robert` denormed to “J. R. Wright”. Reminted to `first_name = 'J. Robert'` (Lightfoot/Kelly pattern).
- Two Lincoln LOA vols were already in prod with Viking / Literary Classics imprints and ISBN-10 on vol 46.

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
