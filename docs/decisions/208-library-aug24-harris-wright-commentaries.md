# 208 — Library Aug 24 Harris / Wright / WBC–PNTC–BECNT

**Date:** 2026-08-24
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built
- Migration `20260824171000_library_aug24_harris_wright_commentaries.sql` (hosted push):
  - **New person:** William D. Mounce (distinct from Robert H. Mounce).
  - **Standalone:** Harris *Prepositions and Theology in the Greek New Testament* (Zondervan 2012; Greek Language Tools); Wright *Old Testament Ethics for the People of God* (IVP Academic 2011 paperback, `original_year` 2004; Ethics).
  - **Commentaries:** WBC Mounce *Pastoral Epistles* (46), Bauckham *Jude, 2 Peter* (50), Lane *Hebrews 1-8* (47A) + *Hebrews 9-13* (47B) — Zondervan Academic reprints; PNTC Kruse *The Letters of John* 2020 2nd ed; BECNT Schreiner *Revelation*.
  - Reused Murray J. Harris, Christopher J. H. Wright, Richard Bauckham, Colin Kruse (no middle), Thomas R. Schreiner, William L. Lane.
  - **Coverage verified** on every Commentary row.

## Decided
- Lane = two catalog rows (47A + 47B), not one set row.
- WBC = Zondervan Academic reprints (not original Word/Nelson barcodes), with `original_year` of the first printing.
- Kruse PNTC = 2020 2nd ed `9780802876676` (not 2000 1st).
- Harris = 2012 hardcover `9780310493921` (not 2021 paperback); genre **Greek Language Tools**.
- Wright = 2011 US paperback `9780830839612`; `original_year` **2004** (this title’s first edition — not 1983 *Living as the People of God*).
- `needs_review = false`. Commentaries `reading_status` reference; Harris/Wright unread.

## Schema changes
- `20260824171000_library_aug24_harris_wright_commentaries.sql` — DML only

## New components / patterns added
- None

## Open questions surfaced
- None

## Surprises (read these before the next session)
- Wright `middle_name = 'J. H.'` still denorms to “Christopher J. Wright” (same `library_compute_author_display` quirk as [207](207-library-aug24-shelf-batch.md)).

## Carry-forward updates
- [x] Decision + PLAN.md
- [ ] components.mdc / AGENTS — n/a
- [ ] tracker Open Questions — n/a
