# 318 — Library Nov 14 shelf batch

**Date:** 2026-11-14
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261114143000_library_nov14_shelf_batch.sql` (hosted push). Seven books.
  - *Psalms 1–41*, *Psalms 42–89*, *Psalms 90–150* — John Goldingay. New series **BCOTWP** (*Baker Commentary on the Old Testament Wisdom and Psalms*), vols 1–3. Baker Academic, Grand Rapids, MI, 2006 / 2007 / 2008. ISBNs `9780801027031`, `9780801027048`, `9780801031434`. Commentary. Coverage: Psalms.
  - *Psalms* — David G. Firth. Existing **ApOTC** vol 14. Apollos, London, 2025, `9781789744859`. Commentary. Coverage: Psalms. No US twin.
  - *Five Festal Garments* — Barry G. Webb (new person, middle `G`). Existing **NSBT** vol 10. Subtitle names the five scrolls. IVP Academic, Downers Grove, IL, 2001, `9780830826100`. Biblical Theology.
  - *Life in the Spirit in Marriage, Home & Work: An Exposition of Ephesians 5:18–6:9* — D. M. Lloyd-Jones. Baker Book House, Grand Rapids, MI, 1975 (copyright 1973), `9780801055508`. Homiletics. Coverage: Ephesians. One passage section, Ephesians 5:18–6:9, pages 1–371.
  - *Shadow of the Almighty* — Elisabeth Elliot. Subtitle *The Life and Testament of Jim Elliot*. Harper & Row, New York, NY, 1978 printing (`original_year` 1958), `9780060622114`. Biography.

## Decided

- Owner: Lloyd-Jones printing **A** (Baker Book House hardcover). Genre **Homiletics**, unread. Elliot is the **1978** Harper & Row printing. Webb is the IVP Academic paperback (**A**).
- Firth attaches to **ApOTC**, not a new `AOTC` series. `AOTC` is the SBL abbreviation for Abingdon.
- Lloyd-Jones is a monograph, the same shape as Carson *Showing the Spirit*. An essay is a citable part inside a parent book (WBC 23B). This volume is the parent. The passage is in the title. Ephesians coverage puts it on by-book **Also on the shelf**. The passage section puts Ephesians 5:18–6:9 on search-passage **On this passage**. Homiletics keeps it off **Commentaries: Ephesians**, which only takes `genre = Commentary`.
- Page span 1–371 is the 1975 catalog extent. The public contents list has no page numbers. Banner of Truth page numbers belong to a later, longer setting and were not copied.
- Psalms commentaries are on **Commentaries: Psalms** by the bible-book rule. No member rows. Webb, Elliot, and Lloyd-Jones match no set rule, so no member row was written.
- `needs_review` false. NSBT stays out of footnotes (`include_in_citation` already false). BCOTWP cites.

## Schema changes

- `20261114143000_library_nov14_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- Firth’s existing ApOTC *1 & 2 Samuel* is still the UK ISBN under publisher “Inter-Varsity Missions.” Left alone.
- Baker Book House, Apollos, and Harper & Row have no `publishers` row, so those three books are free text. Baker Academic and IVP Academic linked.
- Some 1978 listings title the Elliot paperback *The Shadow of the Almighty: The Life & Times of Jim Elliot*. Recorded the title Parker used, with the 1958 subtitle.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified (Psalms on all four; Ephesians on Lloyd-Jones)
- [x] Passage section verified (`verse_start_abs` 5018, `verse_end_abs` 6009)
