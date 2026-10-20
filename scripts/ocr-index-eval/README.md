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
    page-01.lines.txt   # hand transcription (one printed entry per line)
    page-01.json        # built rows
    page-01.ocr.json    # index-mode OCR
  images/               # gitignored page rasters (page-0N-full.png)
  build-gold.ts
  page-ocr.ts           # column split + two passes → page-0N.ocr.json
  compare.ts            # row-level exact-match report
  parse-turretin-text.ts # FineReader PDF text layer → turretin.* (gitignored)
```

## Turretin PDF text layer

Owner English PDF (outside repo). No OCR:

```bash
npx tsx scripts/ocr-index-eval/parse-turretin-text.ts "/path/to/…-scripture-index.pdf"
```

Writes `turretin.lines.txt`, `turretin.review.txt`, `turretin.rows.json` next to the script (gitignored). PDF path: argv, else `TURRETIN_PDF`, else the script default under `Documents/ppp/PDFs for parsing/`. Ends with a gold-leaf diff for printed pp. 760 / 764 / 766.

Apocrypha headings (2 Esdras … 2 Maccabees; printed `Son of Sirach` → `Sirach`) become real `# book` rows in `rows.json`. DB `bible_books` vocab is deferred.

### Review file contract

Under each `# p.NNN col N` block:

- `reason:` / `book:` / raw line (as emitted by parse)
- `corrected: <line>` — re-parse accepts this **in place** (keep `book:`)
- `skip: <why>` — drop noise (e.g. whole-book pointer) without a corrected line

Resolved `corrected:` / `skip:` blocks are preserved across re-parse. **`turretin-manual-corrections.ts`** is merged on every parse (same `page:col:raw` keys) so hand fixes survive review-file churn. Gate fails only on **open** blocks (raw present, neither directive).

FineReader quirks: middle **`4`** often encodes an en-dash in glued verses (`8:141` → `8:1–11`); **`1` misread as `4`** in verse blobs (`16:1345` → `16:13–15`, `15:1345` → `15:13–15`, `6:941` → `6:9–11`, `8:1042` → `8:10–12`, `139:740` → `139:7–10`). **`B:` / `D:` / `D9:`** at line start → chapter **13** (or **139** for `D9`). **`l` / `lff`** → leading **1** + strip **`ff.`**

### Review gate (before DB import)

```bash
npm run turretin:parse          # argv PDF or TURRETIN_PDF
npm run turretin:review-summary # open / corrected / skipped; by reason prefix + page
npx tsx scripts/ocr-index-eval/turretin-prune-review.ts --write  # dedupe review blocks
npm run turretin:gate           # exit 0 pass / 2 fail
npm run turretin:gate -- --parse "/path/to/…-scripture-index.pdf"
```

**Fail if:**

- any open review block
- gold leaves overall &lt; 99.5% **or any extra** on pp. 760 / 764 / 766 (misses = warnings; known `8:141` / `7:1749` still need `corrected:` for a full pass because they stay open in review)
- `turretin.lines.txt` chapter-went-backwards / entry before `# book`
- rows: unknown book, chapter/verse out of range, `out_of_canonical_order`, suspicious verse (&gt;100 non-Psalms)
- zero apocrypha rows, or `Son of Sirach` spelling in rows
- duplicate `rowKey` rows in `rows.json` (same compare key twice)

**Warn-only:** `short_page_among_longer` (accept gate also ignores it — valid `1:10` beside `1:242`).

Policy + agent routing: [274](../../docs/decisions/274-turretin-review-gate-and-routing.md), [workflow](../../docs/session-prompts/turretin-text-layer-workflow.md).

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

1. Photograph 3 dense index pages; keep the images in `images/` (gitignored). Turretin vol. 3 is three columns.
2. Hand-transcribe into `gold/page-0N.lines.txt` (one printed entry per line; `# book` / `# running_book` / `# source`). Build rows:

```bash
npx tsx scripts/ocr-index-eval/build-gold.ts
```

3. Run index-mode OCR (column split, two passes, consensus) and write `gold/page-0N.ocr.json`:

```bash
npx tsx scripts/ocr-index-eval/page-ocr.ts
```

Needs `ANTHROPIC_API_KEY`. A blank `bible_book` is filled from the file's `running_book` before compare, the same carry the batch merge uses when a leaf does not reprint the heading.

4. Compare:

```bash
npx tsx scripts/ocr-index-eval/compare.ts
```

Pass a directory to compare a practice set without mixing it into the page-index gate (`gold/calvin/`).

5. Iterate prompt / consensus / column-split until exact-match ≥ 0.995. Record rate + minutes/page in the decision log, then start S5 capture.
