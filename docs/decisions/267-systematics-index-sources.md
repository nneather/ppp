# 267 — Systematics index sources

**Date:** 2026-10-19
**Module:** library
**Tracker session:** ad-hoc (where the scripture indexes live)

## Built

- Nothing coded. Capture sources for the four systematic sets are written down so the next session does not re-research them.

## Decided

- **Turretin comes from Parker’s English PDF** of the P&R set. He is tracking that file outside this repo (2026-10-19). It is the same owner scan the gold leaves already cite. The 1734 Latin index was looked up and is not the capture source.
- **Calvin stays shelf photos** of the Battles / McNeill index. The locator rules are already in [262](262-calvin-index-capture-rules.md).
- **van Mastricht and Bavinck are not chosen yet.** The public-domain paths below are the working theory. Their English indexes remain the fallback if a path fails a spot-check.

## Turretin — Parker’s English PDF

Use the English PDF Parker already has. The file is not in this repo; he is tracking it elsewhere. The gold transcriptions name it: “Owner scan,” P&R *Institutes of Elenctic Theology*, volume 3 scripture index.

On those leaves the PDF page is the printed page plus 20: printed p. 760 is PDF page 780, p. 764 is 784, p. 766 is 786 (`scripts/ocr-index-eval/gold/page-0N.lines.txt`).

The index is in volume 3 only. Three columns. Arabic `vol:page` (volume 2 page 620 is `volume: "2"`, `page_start: "620"`). Pagination is per volume. The book name is printed only when it changes. It opens at Genesis on the leaf before printed p. 740 and runs through printed p. 780 ([263](263-systematics-page-index-gold-gate.md)). The gold gate on three of those leaves passed at 99.610%. Bulk capture reads the rest of that index from the same PDF.

Store `vol:page`, then let the English outline supply the topic and question (`XV.17`).

### Latin index — looked up, not the source

The 1734 *Institutio* (Halle) has an *Index locorum S. Scripturae, quae in hoc volumine explicantur, vel vindicantur* at the end of each part. Pars tertia, the leaf stamped page 747: https://www.deutsche-digitale-bibliothek.de/item/T3J7LD7R7XAN7OZW7JYSFRAMG3K733PB

Legend: *Prior numerus paginam, posterior thesim notat.* First number is the page of that Latin part; second is the thesis. Genesis 2:18 is page 285, thesis 17. It lists passages explained or defended, not every allusion. Pars quarta: https://www.deutsche-digitale-bibliothek.de/item/YFKSHJCV6WEOVYUIAI3DH7IOJF5UKWEY. Edinburgh 1847 (https://archive.org/details/institutiotheolo02turr) is a different pagination. Do not capture from these.

## Calvin — pictures

Photograph the Battles index. Save section locators (`1.13.7`, including ranges) on the volume whose outline owns that chapter ([262](262-calvin-index-capture-rules.md)). No public-domain substitute was chosen.

## van Mastricht — theory, not chosen

Latin *Theoretico-practica theologia* is public domain (died 1706). 1724 Amsterdam, Internet Archive, Public Domain Mark:

- https://archive.org/details/bub_gb_w79gZZt2tVUC (tomus primus)
- https://archive.org/details/bub_gb_OdhGVl1Ag1YC (tomus secundus)

The *index capitum* already names the passage each chapter expounds, with book and chapter: sanctification of the redeemed is 1 Thessalonians 5:23; sacraments in general is Genesis 17:11; baptism is Colossians 2:12; the Supper is Mark 14:22–23. The English Reformation Heritage Books set keeps those book and chapter numbers and the same opening text. An English table-of-contents scan attaches the label and the page range. That is the chapter-opening layer (`book_passage_sections`), not every incidental citation.

A fuller scripture index exists. The 1699 Utrecht edition ends in about 56 pages of indexes, and the modern Dutch reprint says its scripture register follows the Latin one. The citation style of that fuller index (book and chapter, or folio page) was not confirmed from a sample leaf.

English scripture indexes are per volume and cite English pages (volume 1 starts at p. 215, volume 2 at p. 595, volume 3 at p. 563).

## Bavinck — theory, not chosen

Dutch 4th edition (Kok, 1928–1930) is public domain. Same text as the 2nd edition, which the English translates, with different page numbers. Do not use the 1901 first edition; it is a shorter book.

Volume 4 back matter, about three pages: *Register van teksten die min of meer verklaard worden*, compiled by C. B. Bavinck. It cites **Dutch volume and page**, not a paragraph:

`Gen. 1:1–3, II 380`

Those pages are 4th-edition pages. The table of contents in the same PDF turns the page into one of paragraphs §1–§62. Those paragraph numbers, and the tighter subparagraph markers `[#101]` (580 of them, usually a few pages), are printed in the English *Reformed Dogmatics*. A table-of-contents scan lands on the large paragraph. `[#n]` is on the Dutch body page, not in the table of contents.

Volume 4 PDF: https://theologienet.nl/bestanden/bavinck-h-gereformeerde-dogmatiek-iv.pdf

This register is the “explained passages” index. The combined scripture index in Baker volume 4 is the long English-page index.

## Schema changes

- None.

## New components / patterns added

- None. Operational notes live in [docs/systematics-capture-checklist.md](../systematics-capture-checklist.md).

## Open questions surfaced

- van Mastricht’s fuller Latin scripture index: book.chapter or folio page?
- Bavinck and van Mastricht capture method, when those sets start.

## Surprises (read these before the next session)

- The public-domain indexes are selective (explained or defended). The English indexes are the exhaustive page indexes, and they cite the English printing.
- Turretin capture is Parker’s English PDF, the same owner scan [263](263-systematics-page-index-gold-gate.md) already measured. The 1734 Latin index stays in this file as a lookup, not a source.
- Number **266** was taken by the book-detail collapse while this note was being filed. This file is **267**.

## Carry-forward updates

- [x] Checklist updated
- [x] PLAN.md next-up points at this file
- [x] No schema, no new helpers
