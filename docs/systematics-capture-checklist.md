# Systematics capture checklist (S5+)

Sources and the choice of which one to use: [267](decisions/267-systematics-index-sources.md).

## Order

1. **Calvin** — *Institutes* (Battles / McNeill). **Shelf photos.** Section locators (`1.13.7`, including ranges), saved on the volume whose outline owns that chapter ([262](decisions/262-calvin-index-capture-rules.md)). A short outline and verified refs are already on volume 2.
2. **Turretin** — *Institutes of Elenctic Theology* (P&R, 3 vols). **Parker’s English PDF**, tracked outside this repo. Same owner scan as the gold leaves. See the square-up below.
3. **van Mastricht** — *Theoretical-Practical Theology* (RHB). Not chosen. Working theory is the Latin *index capitum* (each chapter already names its opening passage). Chapter-opening texts are `book_passage_sections`.
4. **Bavinck** — *Reformed Dogmatics* (Baker, 4 vols). Not chosen. Working theory is the Dutch 4th-edition register (volume + page → § via that PDF’s table of contents).

Do one set per session. Do not start van Mastricht or Bavinck while Turretin or Calvin is in progress.

## Turretin square-up

Source: Parker’s English PDF of the P&R set, tracked outside this repo. The gold files call it the owner scan. Printed page + 20 = PDF page on the leaves already transcribed (760 → 780, 764 → 784, 766 → 786).

Volume 3 only. Three columns. Arabic `vol:page`. Genesis on the leaf before printed p. 740 through printed p. 780. Gold gate 99.610% ([263](decisions/263-systematics-page-index-gold-gate.md)).

1. **Text layer first:** `npx tsx scripts/ocr-index-eval/parse-turretin-text.ts` on Parker’s PDF ([270](decisions/270-turretin-text-layer-parser.md)). Clear `turretin.review.txt` (apocrypha + damaged tokens). Gold leaves pp. 760/764/766 should match before insert.
2. OCR only for leaves the text layer cannot parse. Scripture index mode. Side-by-side **Verified** pass. The book name prints only when it changes.
3. Save `vol:page`. The outline on each English volume supplies the topic and question.
4. Smoke — `/library/search-passage?bible_book=1+Thessalonians&chapter=1&verse=5` shows the Systematic theologies band.

The 1734 Latin index (page + thesis) is written up in [267](decisions/267-systematics-index-sources.md). It is not this capture.

## Per set, when the source is a shelf index

1. **Shelf check** — where is the scripture index? `vol:page`, page-only, or a section locator?
2. **TOC → Outline** — on each volume book detail, Paste TSV (`locator\\tlabel\\tpages`) or add sections. Cover body pages only (skip roman front matter).
3. **Index → refs** — Scripture index mode on the OCR queue; photograph; side-by-side **Verified** pass; Save.
4. **Set routing** — `vol:page` tokens route to sibling volumes via `systematics-set-routing`.
5. **Smoke** — the 1 Thessalonians 1:5 search above.
6. **Decision log** — pages, OCR rate, minutes per page, surprises.

## Already seeded (dev smoke)

Hand-entered 1 Thessalonians examples (Turretin 2:620 Full Assurance; van Mastricht 2:249 / 3:70–72 / 4:392; Bavinck RD 4:136 Repentance) so the band and MCP tool work before bulk capture.
