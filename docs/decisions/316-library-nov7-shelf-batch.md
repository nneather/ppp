# 316 — Library Nov 7 shelf batch

**Date:** 2026-11-07
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261107180100_library_nov7_shelf_batch.sql` (hosted push). Seven new books, eight new people. *The Celebration Hymnal* was already on the shelf and was left alone.
  - *The Message of Lamentations* — Christopher J. H. Wright. BST. IVP Academic, Downers Grove, IL, 2023, original year 2015, `9781514006399`. Commentary. Coverage: Lamentations.
  - *The Message of Hebrews* — Raymond Brown (new person; not Raymond E. Brown). Subtitle *Christ above All*. BST. IVP, Downers Grove, IL, 1982, `9780877842897`. Commentary. Coverage: Hebrews.
  - *Song of Songs and Lamentations* — Duane A. Garrett and Paul R. House. WBC 23B. Zondervan Academic, Grand Rapids, MI, 2016, original year 2004, `9780310522195`. Commentary. Coverage on the volume: Song of Songs and Lamentations. Essays: Song of Songs, Garrett, pp. 1–277; Lamentations, House, from p. 278.
  - *The Book of Lamentations* — John Goldingay. NICOT. Eerdmans, Grand Rapids, MI, 2022, `9780802825421`. Commentary. Coverage: Lamentations.
  - *Ecclesiastes* — Michael A. Eaton. TOTC 16. IVP Academic, Downers Grove, IL, 2009, original year 1983, `9780830842186`. Commentary. Coverage: Ecclesiastes.
  - *The Development of Greek and the New Testament* — Chrys C. Caragounis. Subtitle on morphology, syntax, phonology, and textual transmission. Baker Academic, Grand Rapids, MI, 2006, original year 2004, `9780801032301`. Greek Language Tools. Reference.
  - *Encyclopedia of Biblical Greek Language and Linguistics* — Stanley E. Porter, Christopher D. Land, Jonathan M. Watt, Dana M. Harris (eds). Baker Academic, Grand Rapids, MI, 2026, `9781540961631`. Biblical Reference. Edited volume. Reference.
  - *God's Good Design* — Claire S. Smith (existing person). Subtitle *What the Bible Really Says about Men and Women*. Edition `2nd`. Matthias Media, Sydney, 2019, original year 2012, `9781925424515`. Biblical Theology. Unread.

## Decided

- Owner answers: Wright 2023 IVP Academic; WBC 2016 Zondervan Academic; Eaton 2009 IVP Academic volume 16; Caragounis 2006 Baker Academic paperback; encyclopedia genre **Biblical Reference**; Brown the 1982 printing; Smith **Biblical Theology**.
- Brown is the US InterVarsity issue whose title page is *The Message of Hebrews: Christ above All* (`9780877842897`, ©1982). The Leicester first printing is *Christ above All* (`9780851107028`, February 1982).
- Encyclopedia is Biblical Reference, so it does not join NT language tools. Caragounis is Greek Language Tools, so he is on that set by the genre rule. No member row either way.
- Commentaries sit on **Commentaries: {book}** by coverage, including each WBC essay. Smith has no set.
- `needs_review` false. Matthias Media stays free text. The other imprints link to existing publisher rows.
- Hymnal skipped. No soft-deletes.

## Schema changes

- `20261107180100_library_nov7_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- `author_display` for Wright is “Christopher J. Wright”. The person row is still Christopher / `J. H.` / Wright; the trigger drops the second initial.
- WBC Lamentations `page_end` is null. House’s introduction starts at 278 in the 2004 text; the index pages after the commentary were not pinned.
- Amazon sometimes calls Eaton “volume 18”. The row is volume 16, with the Job Andersen / Psalms Longman numbering already on the shelf.
- The current TOTC Ecclesiastes replacement is Knut Martin Heim (2019). This row is Eaton.
- Raymond E. Brown was already on file (`middle_name` `E`, no period). The BST author is a separate Raymond Brown with a null middle.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified, including both WBC essays
- [x] No `resource_set_members` rows
