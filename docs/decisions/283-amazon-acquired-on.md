# 283 — Amazon order dates for acquired_on

**Date:** 2026-10-20
**Module:** library
**Tracker session:** ad-hoc (PLAN.md › Next up #2)

## Built

- Pure matcher `src/lib/library/amazon-acquired-on.ts`. Amazon Items CSV in, proposals out. No network and no database in the unit tests.
- CLI `npm run library:amazon-acquired -- <orders.csv>`. Dry-run prints ISBN match, title suggestion, miss, and skipped Kindle, plus a preview (book id, title, current `acquired_on`, proposed date, order id, `earlier` / `later` / `same`). Writes `data/library_amazon_acquired_preview.tsv` (gitignored).
- `--apply` is refused without `LIBRARY_AMAZON_ACQUIRED_CONFIRM=yes`. It updates `acquired_on` only, and only for ISBN matches whose date differs. Title suggestions are never written.

## Decided

- ISBN-10/13 via `isbnMatchKeys` is the only write path. An ISBN that hits nothing is a miss, not a title guess — that would date a different edition.
- Title match is exact after stripping articles, parentheticals, and punctuation. It runs for Category `Books` or `ABIS_BOOK` (legacy print Format too). A key shared by two owned books is ambiguous and is not suggested.
- Several orders for one book keep the earliest date. A same-day tie keeps the lower order id.
- Kindle, ebook, and audiobook rows are skipped unless the library title, subtitle, or edition says that it is that edition. A Kindle line whose ASIN is the print ISBN does not move the print row.
- Cancelled lines and quantity `0` are skipped. Unowned stubs are not loaded. No match leaves `acquired_on` as it is.
- A proposed date later than the current value is still an ISBN write (`direction=later`). The backfill is the day the row was entered, so a later Amazon date can be a reorder — Parker scans those rows in the dry-run before confirming.
- An earlier title-only order stays on the suggestion list when an ISBN order for the same book is later. It is not applied.

## Schema changes

- None. `books.acquired_on` already exists (default `current_date`, backfilled from `created_at::date` in [244](244-studies-session-1.md)).

## New components / patterns added

- `src/lib/library/amazon-acquired-on.ts` — parse + match + preview text. CLI `scripts/library-amazon-acquired/applyAcquiredOn.ts`.

## Open questions surfaced

- ISBN apply is done (196 rows, 2026-10-20). Books with no Amazon ISBN hit still have the `created_at` date. Two title suggestions are earlier and were not written: Building a Vision for Your Life (2024-10-06) and Additional Notes on Exodus (2026-09-05).

## Surprises (read these before the next session)

- Direct SQL (`auth.uid()` null) bypasses the viewer-column trigger, same as the language audit. `audit_log.changed_by` will be null on these updates. The trigger still writes the row.
- Many print books in the Items report use a `B…` ASIN, not an ISBN-10. Those can only become title suggestions.
- Amazon dates in the wild are `M/D/YY` as well as ISO. Two-digit years use the 1970 pivot (95 → 1995, 19 → 2019).

## Carry-forward updates

- [x] components.mdc — no UI component
- [x] AGENTS.md inventory updated
- [x] new env vars documented (`LIBRARY_AMAZON_ACQUIRED_CONFIRM` in the script README)
- [x] Studies tracker B1 notes the ISBN apply; books with no Amazon hit remain

## Verification

- `npm run check` — 0 errors / 0 warnings.
- `npm run test` — 780/780 (20 new Amazon matcher tests).
- Parker’s `Order History.csv` (772 rows, privacy export: Product Name + ASIN + Department). ISBN match 198. `--apply` updated **196** `acquired_on` values, all earlier than the catalog date. A second dry-run reported would-write 0. Four title suggestions were not written. No order CSV was committed.
