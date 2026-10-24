# 309 — Five archived OT papers

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Five papers, status `archived` (complete, not published), each bibliography attached as `cited`:
  - Proverbs 31:1–9 (OT340, linked course, due 15 October 2026)
  - Genesis 22:1–19 (OT305, due 12 December 2025)
  - Word study of ירא in Deuteronomy 13:4–5 (OT305, due 14 May 2025; the file had no title)
  - Exodus 23:20–33 (OT320, due 31 October 2025)
  - 1 Kings 12 (OT330, due 4 May 2026)
- OT305, OT320, and OT330 stay in notes. No new courses.
- Owned Lovell, *1 & 2 Kings* (Hodder Bible Commentary, 2025). Coverage is 1 Kings and 2 Kings, so it lands on those commentary sets by rule.
- Essays added on books already owned: Silva, “Galatians,” on Beale/Carson; Gilmour, “Shechem”; McKnight, “Rehoboam”; Soza, “Jeroboam,” on *Dictionary of the Old Testament: Historical Books*.
- Buchem and Fox are not-owned book stubs. The full journal citation is on the source note. The compiled bibliography will not format them as articles.

## Decided

- Shelf copy used for Gesenius (Oxford, 1982) and BDB (Hendrickson, 1994).
- Alexander’s row is the 4th edition (Baker Academic, 2022, ISBN 9781540963406). `original_year` keeps 1995.
- NAC Genesis was already right: 1A is 1996, ISBN 9780805401011; 1B is 2005, ISBN 9780805401417. The paper’s 2006 is the slip. The shared author was “Kenneth A. Matthew”; both volumes now read Mathews.
- Provan is the 1995 Hendrickson NIBC (ISBN 9781565630536). The row had been the 2012 Baker ebook ISBN.
- Wright, *Exodus*, is the 2021 Zondervan Academic hardcover (ISBN 9780310490692). The row had been the 2021 ebook.
- Walsh, *1 Kings*, is the 1996 Liturgical Press hardcover (ISBN 9780814650448, Collegeville, Minn.). The row had been the 2021 paperback.
- Sarna, *Genesis*, stays 2001. Provan stays the 1995 Hendrickson NIBC. Lovell stays 2025.
- TDOT attaches the one not-owned stub. NIDOTTE (5), TWOT (2), Calvin *Institutes* (2), Turretin (3), and von Rad (2) attach every owned volume. Compiled bibliographies list each volume.
- Sklar’s two Exodus lectures stay off the paper.
- No bibliography headings, so sources are ungrouped, in bibliography order.

## Schema changes

- DML only: `supabase/migrations/20261024185000_studies_ot_exegesis_papers.sql` and `supabase/migrations/20261024191000_studies_ot_papers_hardcovers.sql`. No new tables. Types unchanged.

## New components / patterns added

- None.

## Open questions surfaced

- Journal articles need a real source type. Prompt is below.
- Gilmour and Soza stay as the dictionary bylines (G. Gilmour, J. R. Soza). Parker declined filling given names.

## Surprises (read these before the next session)

- NAC 1A and 1B did not need a year or ISBN change. The author spelling was the shared error.
- Provan’s shelf ISBN was an ebook of the renamed series (Understanding the Bible Commentary, 2012), while the publisher and series on the row were still Hendrickson / NIBC.
- Walsh’s first ISBN was the 2021 paperback. The shelf copy is the 1996 hardcover.
- The word-study file has no title page. The stored title is “The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5.”

## Carry-forward updates

- [x] components.mdc updated — no new component
- [x] AGENTS.md inventory updated — no new helper
- [x] new env vars — none
- [x] tracker follow-on noted

## Session prompt — journal articles

```
Session: studies — journal articles as sources
Tracker: docs/POS_Studies_Build_Tracker.md, follow-on
Read: AGENTS.md, docs/decisions/306-inheritance-paper-bibliography.md,
  docs/decisions/309-ot-exegesis-papers.md,
  src/lib/studies/paper-bibliography.ts, src/lib/types/library.ts
Supabase: hosted db push only
Goal: Decide how a paper or sermon cites a journal article without pretending it is a book.
Acceptance:
 - [ ] Lock whether an article is a new table, an essay with no parent book, or a book stub with a citation kind
 - [ ] Turabian article footnote and bibliography (author, title, journal, volume, issue, year, pages)
 - [ ] Existing stubs (Denton; Buchem; Fox) have a migration path
 - [ ] Compiled bibliography and .docx use the article form
 - [ ] npm run check and npm run test pass
```
