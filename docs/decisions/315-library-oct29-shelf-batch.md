# 315 — Library Oct 29 shelf batch

**Date:** 2026-10-29
**Module:** library
**Tracker session:** ad-hoc shelf add (`library-add-books`)

## Built

- Migration `20261029210000_library_oct29_shelf_batch.sql` (hosted push). Four new books, one corrected row, two new series, four new people.
  - *A Grammar of the Greek New Testament in the Light of Historical Research* — A. T. Robertson. Edition `4th`. Broadman Press, Nashville, TN, 1934. ISBN null (the `9780805413083` barcode is a later B&H printing). Greek Language Tools. Reference.
  - *Exegetical Fallacies*, 3rd — D. A. Carson and Andrew David Naselli. Baker Academic, Grand Rapids, MI, 2026, `9781540969224`. Greek Language Tools. Unread.
  - *A Patristic Greek Reader* — Rodney A. Whitacre. Baker Academic reprint, Grand Rapids, MI, 2012, original year 2007, `9780801048012`. Greek Language Tools. Reference.
  - *Der Brief an die Hebräer* — Hans-Friedrich Weiß. KEK 13, edition `15th` (first Weiß Auslegung). Vandenhoeck & Ruprecht, Göttingen, 1991, `9783525516256`. Commentary. German. Reference. Coverage: Hebrews.
  - *Pauline Communities as 'Scholastic Communities'* — Claire S. Smith. Subtitle: A Study of the Vocabulary of 'Teaching' in 1 Corinthians, 1 and 2 Timothy and Titus. WUNT II 335. Mohr Siebeck, Tübingen, 2012, `9783161519635`. Acts and Paul. Unread.
- Existing *Exegetical Fallacies* (Carson only) corrected to the Baker US 2nd edition: year 1996, edition `2nd`, ISBN `9780801020865`. Publisher stays Baker Books. Reading status stays `read`.

## Decided

- Owner 1a: the copy already on the shelf is the Baker US 2nd, not the Paternoster ISBN that was stored (`9780853646778`, left for a shelf check in [133](133-baker-publisher-link-pass.md)).
- Owner 2b: Whitacre is the 2012 Baker Academic reprint, not the 2007 Hendrickson original.
- Robertson 1934 Broadman is the 4th edition. ISBN stays null.
- New series **KEK** (not the existing EKK) and **WUNT II** (second series only). Both `include_in_citation` default true.
- Greek Language Tools for the grammar, both Fallacies editions, and the reader, so they sit on **NT language tools** by the genre rule. No member row. Weiß is on **Commentaries: Hebrews** by coverage. Smith has no set.
- `needs_review` false. Work type monograph.
- Baker Academic links to the existing publisher row. Broadman Press, Vandenhoeck & Ruprecht, and Mohr Siebeck stay free text. No new registry rows.
- Smith’s subtitle is `books.subtitle`. The short title is the series title.

## Schema changes

- `20261029210000_library_oct29_shelf_batch.sql` — DML only

## New components / patterns added

- None

## Open questions surfaced

- None

## Surprises (read these before the next session)

- The stored Fallacies ISBN was the 1996 Paternoster 2nd (`9780853646778`) while year was 1984 and the publisher string was already Baker Books. The US Baker 2nd ISBN is `9780801020865`.
- Open Library tags the 1934 Broadman grammar as a 2nd edition. It is a reprint of the 4th (1923 text).
- Weiß KEK 13 is the 15th Auflage of the Hebrews slot and the first edition of his commentary (Michel was the 14th).
- `author_display` for the 3rd edition is “D. A. Carson, Andrew D. Naselli”. The person row is Andrew / David / Naselli; the denorm abbreviates the full middle name.
- The pre-existing 2nd-edition author row is `sort_order` 1. Display is still “D. A. Carson”. Left as-is.
- Two *Exegetical Fallacies* rows share a title. The idempotent key for the standalone insert includes edition.

## Carry-forward updates

- [x] Decision + PLAN.md
- [x] No new helpers (AGENTS.md / components.mdc unchanged)
- [x] DML-only — skipped `gen-types`
- [x] Commentary coverage verified: Weiß → `{Hebrews}`
- [x] No `resource_set_members` rows
