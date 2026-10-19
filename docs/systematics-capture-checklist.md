# Systematics capture checklist (S5+)

After the OCR gold gate passes (≥99.5% — [scripts/ocr-index-eval/README.md](../scripts/ocr-index-eval/README.md)), capture one set per session.

Order by payoff:

1. **Turretin** — *Institutes of Elenctic Theology* (P&R, 3 vols)
2. **van Mastricht** — *Theoretical-Practical Theology* (RHB, 5 vols) + chapter-opening texts as `book_passage_sections`
3. **Bavinck** — *Reformed Dogmatics* (Baker, 4 vols)
4. **Calvin** — *Institutes* (Battles, 2 vols)

## Per set

1. **Shelf check** (from Session 0): where is the scripture index? `vol:page` or page-only? Continuous pagination across volumes?
2. **TOC → Outline** — on each volume book detail, Paste TSV (`locator\\tlabel\\tpages`) or add sections. Cover body pages only (skip roman front matter).
3. **Index → refs** — open any volume (or the index volume); enable **Scripture index mode** on the OCR queue; photograph index pages; run OCR; side-by-side **Verified** pass; Save.
4. **Set routing** — when the printed index uses `vol:page`, volume tokens route rows to sibling books via `systematics-set-routing` (explicit volume wins; else outline page bounds; else default book).
5. **Smoke** — `/library/search-passage?bible_book=1+Thessalonians&chapter=1&verse=5` should show the Systematic theologies band with labels.
6. **Decision log** — one file per set: pages photographed, OCR rate, minutes/page, surprises.

## Already seeded (dev smoke)

Hand-entered 1 Thessalonians examples (Turretin 2:620 Full Assurance; van Mastricht 2:249 / 3:70–72 / 4:392; Bavinck RD 4:136 Repentance) so the band and MCP tool work before bulk OCR.
