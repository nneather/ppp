# 246 — Library Oct 19 shelf: NIDOTTE, BECNT, WBC Thessalonians

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261019193000_library_oct19_nidotte_shelf.sql` (hosted push). Eleven new books, six new people, series **NIDOTTE**.
  - *Advances in the Study of Biblical Hebrew and Aramaic* — Benjamin J. Noonan. Zondervan Academic, Grand Rapids, MI, 2020 `9780310596011`. Hebrew Language Tools. Subtitle “New Insights for Reading the Old Testament.”
  - *Forward Progress* — Bill Connelly. Triumph Books, Chicago, IL, 2025 `9781637278703`. Sports. Subtitle “The Definitive Guide to the Future of College Football.”
  - *The Celebration Hymnal* — Tom Fettke, editor. Word Music, Nashville, TN, 1997 `9783010142366` (gray pew). Hymnals and Liturgy, `edited_volume`.
  - *Colossians and Philemon* — Gregory K. Beale (existing person). BECNT. Baker Academic, 2019 `9780801026676`. Coverage: Colossians, Philemon.
  - *1 and 2 Thessalonians*, 2nd ed. — Seyoon Kim and F. F. Bruce. WBC 45. Zondervan Academic, 2023 `9780785250210`. Coverage: 1 Thessalonians, 2 Thessalonians. The 2015 Bruce row stays.
  - *1-2 Thessalonians* — Jeffrey A. D. Weima. BECNT. Baker Academic, 2014 `9780801026850`. Coverage: 1 Thessalonians, 2 Thessalonians.
  - *New International Dictionary of Old Testament Theology and Exegesis* — Willem A. VanGemeren, editor. Five rows, vols 1–5, `total_volumes` 5, 1997 hardcover, publisher Zondervan. Per-volume ISBNs `9780310481706`, `9780310202172`, `9780310202189`, `9780310202196`, `9780310213116`. Biblical Reference. Series `include_in_citation` false.
- Bruce WBC 45 ISBN corrected from ebook `9780310586371` to hardcover `9780310521990` (year stays 2015).
- Follow-up `20261019194000_library_weima_name_parts.sql`: Weima `first_name` is `Jeffrey A. D.` so the shelf line is not “Jeffrey A. Weima.”

## Decided

- Kim/Bruce is a second WBC 45 row. The 2015 Bruce volume stays (owner 1A).
- NIDOTTE is the 1997 hardcover, five rows, per-volume ISBNs, not the 2012 paperback set barcode (owner 2A). Same shape as NIDNTTE.
- Hymnal is the gray pew edition. Fettke is editor. Did not copy the fake “Word Music” person on the 1986 hymnal.
- Beale reuses `Gregory` / `K.` / `Beale`. BECNT volumes still omit `volume_number`.
- Triumph Books and Word Music stay free-text. Zondervan, Zondervan Academic, and Baker Academic link to existing publisher rows.
- `needs_review` false. Reading status `reference` for the commentaries and NIDOTTE; `unread` for Noonan, Connelly, and the hymnal.
- No Bible coverage on NIDOTTE (reference set, not a commentary).

## Schema changes

- `20261019193000_library_oct19_nidotte_shelf.sql` — DML only
- `20261019194000_library_weima_name_parts.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- `library_compute_author_display` keeps only `left(middle_name, 1)`. A middle of `A. D.` prints as “A.” Put the extra initials in `first_name` (J. N. D. Kelly / J. Robert Wright).
- The existing WBC Thessalonians ISBN was the ebook. Print hardcover is `9780310521990`.
- Kim/Bruce must be keyed by ISBN. Title + WBC also matches the 2015 Bruce row, so a title join would attach Kim to the wrong book and skip the insert.
- BECNT’s series name in prod is “Baker Exegetical Commentary **of** the New Testament.” Left as-is.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified (Colossians, Philemon, both Thessalonians volumes)
