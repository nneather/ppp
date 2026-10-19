# 250 — Passage sections research pass (Wave 1 + Snodgrass)

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (follow-on to [249](249-library-passage-sections.md))

## Built

- Curated `book_passage_sections` rows for five owned books (edition-matched TOCs; pages from public contents, not invented):
  - D. A. Carson, *Showing the Spirit* (2019 Baker) — four chapter sections on 1 Corinthians 12–14.
  - Craig Keener, *Paul, Women, and Wives* (1992 Hendrickson) — five passage sections (1 Cor 11 / 14; 1 Tim 2; Eph 5–6).
  - Köstenberger/Schreiner, *Women in the Church*, 3rd ed. (2016) — one search section for 1 Timothy 2:9–15 (pp. 19–340). The seven chapter essays were already cataloged; they stay the citation surface.
  - Daniel Doriani, *Women and Ministry* (Crossway 2003 TOC; catalog `year` was null → set to **2003**) — Genesis 1, Ephesians 5, Corinth, 1 Timothy 2.
  - Klyne Snodgrass, *Stories with Intent* (2018 / 2nd ed., GBV/Bowker TOC) — 41 rows (one per parable × gospel when synoptic), pages unchanged from the 2008 body.
- Live totals after pass: **56** sections on **6** books (includes Bonhoeffer Matt 5–7 from [249](249-library-passage-sections.md)).
- Audit: INSERT rows on `book_passage_sections` for the new set.
- Owner smoke: `/library/search-passage?bible_book=1+Corinthians&chapter=13&verse=1` → On this passage shows Carson “The Most Excellent Way” + Doriani Corinth chapter; `Luke&chapter=15&verse=11` → Snodgrass Prodigal (pp. 117–144).

## Decided

- **Women in the Church** keeps essays for Turabian; add **one** book-level passage section so search-passage surfaces the volume without duplicating essays as sections.
- Synoptic Snodgrass entries get **one row per gospel** sharing the same page range (search is per `bible_book`).
- Skip Carson ch. 5 (theology of gifts, not a continuous pericope). Skip Snodgrass intro / “Recent Contributions” / eschatological-discourse survey without a single passage.

## Schema changes

- None (data only). Optional catalog fix: `books.year = 2003` on Doriani *Women and Ministry*.

## New components / patterns added

- None.

## Open questions surfaced

- Whether Doriani’s Corinth chapter (pp. 71–86) should be narrowed once a physical TOC confirms it is only 1 Cor 11 vs 11–14.
- Later candidates from the research plan (Wright JVG/RSG, Poythress, sermon sets) still deferred.

## Surprises (read these before the next session)

- Women in the Church already had seven essays; the research plan’s “check essays vs sections” path was the right call.
- Snodgrass 2018 page numbers for the parable body match the Bowker TOC for ISBN 9780802875693 (second edition).

## Carry-forward updates

- [x] decision filed
- [x] PLAN.md refreshed
- [ ] components.mdc — n/a
- [ ] AGENTS.md — n/a
- [ ] new env vars — none
