# OCR scripture-index eval (gold gate)

Accuracy gate for systematics-by-passage bulk capture ([252](../../docs/decisions/252-systematics-by-passage-session-0.md)).

**Do not start bulk Turretin / van Mastricht / Bavinck index capture until eval exact-match ≥ 99.5%.** Calvin is a section-locator practice set, not this page-index gate ([252](../../docs/decisions/252-systematics-by-passage-session-0.md)). Its gold lives in `gold/calvin/` and is compared on its own:

```bash
npx tsx scripts/ocr-index-eval/compare.ts scripts/ocr-index-eval/gold/calvin
```

## Layout

```
scripts/ocr-index-eval/
  README.md
  gold/
    page-01.json   # hand-transcribed rows for one index page image
    page-02.json
    page-03.json
  compare.ts       # pure row-level exact-match report
```

## Gold file shape

```json
{
  "id": "page-01",
  "source": "Turretin Institutes vol.3 scripture index p.812 (P&R)",
  "rows": [
    {
      "bible_book": "1 Thessalonians",
      "chapter_start": 1,
      "verse_start": 5,
      "page_start": "620",
      "volume": "2"
    }
  ]
}
```

Keys compared (exact): `bible_book`, `chapter_start`, `verse_start`, `chapter_end`, `verse_end`, `page_start`, `page_end`, `volume`.

## Workflow

1. Photograph 3 dense index pages; keep the images aside.
2. Hand-transcribe into `gold/page-0N.json` (200–300 rows total).
3. Run OCR index mode on the same images (UI or script); save candidates JSON beside each gold file as `gold/page-0N.ocr.json`.
4. Compare:

```bash
npx tsx scripts/ocr-index-eval/compare.ts
```

Pass a directory to compare a practice set without mixing it into the page-index gate (`gold/calvin/`).

5. Iterate prompt / consensus / column-split until exact-match ≥ 0.995. Record rate + minutes/page in the decision log, then start S5 capture.
