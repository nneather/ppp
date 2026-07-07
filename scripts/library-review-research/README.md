# library-review-research — AI research pass for the review queue

Proposes metadata fixes for `needs_review` books (decision [068](../../docs/decisions/068-library-review-ai-research-pass.md), from [064](../../docs/decisions/064-usage-retrospective-review.md) Q3). Writes one **pending** row per book into `book_metadata_proposals`; the owner accepts/rejects on the `/library/review` card (Research deck). The script never updates `books` and never clears `needs_review`.

## What it proposes

| Field | Source | When |
|---|---|---|
| `year` | Open Library edition (`publish_date`) | book has ISBN, `year IS NULL` |
| `publisher` | Open Library edition (`publishers[0]`) | book has ISBN, no publisher text or FK |
| `publisher_location` | Open Library edition (`publish_places[0]`) | location missing and a publisher is known/proposed |
| `genre` | Anthropic (`ANTHROPIC_API_KEY`), closed `GENRES` enum, batched 20/call, one-line rationale | `genre IS NULL`; skipped with a warning when the key is absent |

Shelf-bound books (`needs_review_note ILIKE '%shelf%'`) and books that already have a pending proposal are excluded. ISBN-bearing books sort first; `--all` includes no-ISBN books (genre-only proposals).

## Env

`.env.local` (same vars as `library-language-audit`):

- `LIBRARY_RESEARCH_DATABASE_URL` **or** `LIBRARY_DST_DATABASE_URL` / `LIBRARY_SRC_DATABASE_URL` — hosted **Dashboard → Connect → Direct** URI
- `ANTHROPIC_API_KEY` — optional; enables genre classification (`ANTHROPIC_RESEARCH_MODEL` overrides the default `claude-sonnet-4-6`)
- `POS_OWNER_ID` (`.env`) — stamped as `created_by` when set

## Run

```bash
npm run library:review-research                                     # dry run → data/library_review_research.tsv
npm run library:review-research -- --limit 100                      # first slice (ISBN books)
npm run library:review-research -- --all                            # include no-ISBN books
LIBRARY_RESEARCH_CONFIRM=yes npm run library:review-research -- --limit 100 --apply
```

Dry runs write the TSV only. `--apply` additionally INSERTs pending proposals (`ON CONFLICT DO NOTHING` against the one-pending-per-book partial unique index, so re-runs are safe). Open Library is throttled at ~300ms/call — budget ~1 min per 100 ISBN books.
