# Amazon order dates → `books.acquired_on`

Match an Amazon **Items** order report to owned library books and propose `acquired_on` from the earliest matching order date.

The `created_at::date` backfill is the day the row was entered. This script replaces that date only when an order ISBN matches.

Do not commit the CSV. Keep it outside the repo, or under `/data/` (gitignored). The preview TSV is written to `data/library_amazon_acquired_preview.tsv`.

## Environment

Hosted Postgres only (Dashboard → Connect → Direct), same resolution as the language audit. The script connects with SSL required.

| Variable                          | Required      | Purpose                                    |
| --------------------------------- | ------------- | ------------------------------------------ |
| `LIBRARY_DST_DATABASE_URL`        | Yes\*         | Hosted direct URI.                         |
| `LIBRARY_SRC_DATABASE_URL`        | Fallback\*    | Used when DST and the audit URL are unset. |
| `LIBRARY_AUDIT_DATABASE_URL`      | Optional      | Overrides DST/SRC.                         |
| `LIBRARY_AMAZON_ACQUIRED_CONFIRM` | For `--apply` | Must be exactly `yes`.                     |

\* `LIBRARY_AUDIT_DATABASE_URL` → `LIBRARY_DST_DATABASE_URL` → `LIBRARY_SRC_DATABASE_URL`.

## Run

```bash
npm run library:amazon-acquired -- /path/to/amazon-items.csv

LIBRARY_AMAZON_ACQUIRED_CONFIRM=yes npm run library:amazon-acquired -- /path/to/amazon-items.csv --apply
```

Dry-run prints counts (ISBN match, title suggestion, miss, skipped Kindle) and the preview: book id, title, current `acquired_on`, proposed date, order id.

`--apply` writes `acquired_on` only, and only for ISBN matches whose date differs. A later date than the current value is included (the preview marks it `later`) because a reorder can be the real purchase — scan those rows before confirming. Title suggestions, Kindle rows, ambiguous ISBNs, and unowned stubs are not written.

## Match rules

- ISBN-10 and ISBN-13 via `isbnMatchKeys`. An ISBN that hits no book is a miss, not a title guess.
- Title match is exact after stripping articles, parentheticals, and punctuation. It runs for Category `Books` or `ABIS_BOOK` (or a print Format on older reports). A repeated title is listed as ambiguous and not suggested.
- Several orders for one book keep the earliest date. The order id on the preview is that order.
- Kindle, ebook, and audiobook rows are skipped unless the library book's title, subtitle, or edition says that it is that edition.
- Cancelled lines and quantity `0` are skipped.
- No match leaves `acquired_on` as it is. `owned = false` stubs are not loaded.
