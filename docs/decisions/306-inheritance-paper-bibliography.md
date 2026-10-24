# 306 — Inheritance paper and bibliography

**Date:** 2026-10-24
**Module:** studies
**Tracker session:** ad-hoc

## Built

- Published paper **Our Share of the Inheritance** (Colossians 1:12), due 7 May 2025. Notes record NT305 and *Presbyterion* 51.2 (Fall 2025): 121–126.
- All 14 bibliography entries attached as **cited**. Owned matches reused: BDAG, Moo PNTC (2024), NA28, Rahlfs Septuaginta, and Foerster’s κληρονόμος article on the owned TDNT volume 3.
- Not-owned works added or filled in: McKnight NICNT, Wright TNTC, Foster BNTC, Pao ZECNT, Echevarria, Lyall, Denton’s *Evangelical Quarterly* article, Brown’s NIDNTT volume 2 (Eichler article), and the existing Hester stub (now 1968, Oliver & Boyd, SJT Occasional Papers 14).

## Decided

- Dictionary and TDNT citations attach the **article**, not the whole set. NIDNTT here is Colin Brown’s dictionary, volume 2 only, not Silva’s NIDNTTE.
- Commentaries he does not own are still `genre = Commentary` with bible coverage, `owned = false`. McKnight and Foster cover Colossians. Wright and Pao cover Colossians and Philemon.
- Wright stays on TNTC without a volume number. The 1986 printing is old-series volume 12; the shelf’s other TNTC volumes use the later numbering (4, 5, 7).
- Foster’s ISBN is null. The bibliography cites London: Bloomsbury T&T Clark; the common paperback ISBN is a US Bloomsbury number.
- Denton’s article is a book-shaped stub (`publisher` Evangelical Quarterly, 1982) because a paper source is a book or an essay. The source note holds the real citation: *Evangelical Quarterly* 54 (1982): 157–62.
- No NT305 course row. Classwork only has the current term. The course stays in the paper notes.
- Murray Harris (EGGNT) is cited in the exegetical worksheet, not the bibliography, so it is not attached. The shelf copy is the 2010 B&H printing.

## Schema changes

- DML only: `supabase/migrations/20261024163000_studies_inheritance_paper.sql` and `20261024172000_studies_inheritance_paper_presbyterion.sql` (issue pages). No new tables. Types unchanged.

## New components / patterns added

- None.

## Open questions surfaced

- The Colossians commentary shelf and By book counts do not filter `owned`. McKnight, Foster, Pao, and Wright will appear there beside owned commentaries.
- Lyall’s title page is the Academie Books imprint. The record uses Zondervan, which is what the bibliography says and what sibling rows use.

## Surprises (read these before the next session)

- Hester’s *Paul’s Concept of Inheritance* was already a not-owned stub with no year. This filled it rather than inserting a second row.
- The library’s Foerster is Friedrich Wilhelm Foerster (*Erlebte Weltgeschichte*), not Werner Foerster the TDNT author. The article uses a new person.
- Eichler’s article is pages 295–303 as cited. Some catalogs end at 304.

## Carry-forward updates

- [x] components.mdc updated — no new component
- [x] AGENTS.md inventory updated — no new helper
- [x] new env vars — none
- [x] tracker follow-on noted
