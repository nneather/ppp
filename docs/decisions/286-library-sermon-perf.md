# 286 — Library and sermon performance

**Date:** 2026-10-21
**Module:** library | studies

## Built

- Book detail and study sources no longer wait on the full people table. `loadBookDetail` and essay loads take author names from the `people` embed. Autocompletes fetch `/library/people.json` when that UI opens (`?counts=1` only for the essay editor).
- A study's source books load in one chunked `.in()` query (`loadBooksByIds`) instead of one `loadBookDetail` per book.
- Sermon and paper navigation returns attached sources immediately. Systematics is a streamed promise. Set suggestions, create-sections, and prior papers load from `GET /studies/import-meta.json` when the import dialog opens.
- Passages with more than 150 systematic hits return set summaries (span + count). Pointers load from `GET /library/systematics.json` when that card opens, or the whole passage when sorting by verse. Smaller passages stay inline. MCP `list_systematics_for_passage` still asks for the full pointers.
- Passage search still waits on the scripture RPC (commentaries, sections, index) and streams the outline work. Systematic rows are not copied into the HTML.
- Book detail shares one `loadSetVolumeBooks` promise for the set UI and the scripture counts. Recorded images load from `GET /library/books/[id]/scripture-images.json` when that disclosure opens.
- `books.title_sort_key` is a stored generated column (`library_title_sort_key`, same EN/DE article rules as `titleSortKey`). `/library` and `books.json` page with one `ORDER BY title_sort_key, id` plus an exact count. `?all=true` and client-side narrow filters still scan the filtered set.

## Decided

- Summarize above 150 hits rather than genre-filtering `search_scripture_refs`. About 95% of refs are already Systematic Theology.
- Leave the desktop Now rail, settings `invalidateAll()`, and dashboard book counts for a later pass.

## Schema changes

- `20261021170839_books_title_sort_key.sql` — immutable `library_title_sort_key(text)`, stored `books.title_sort_key`, partial index `(title_sort_key, id) WHERE deleted_at IS NULL`. Applied to hosted ppp. Types regenerated.

## New components / patterns added

- `GET /library/systematics.json` — full pointers for one series, one book, or the whole passage.
- `GET /library/books/[id]/scripture-images.json` — signed thumbs for the recorded-images disclosure.
- `GET /studies/import-meta.json` — import dialog payload (suggestions, sections, prior papers).
- `loadBooksByIds`, `loadStudyImportMeta`, `systematicBlocksFromRpcRows`.

## Open questions surfaced

- Now-rail JSON, settings `invalidateAll()`, and the dashboard's exact book count still run on other navigations.
- A review-queue scripture badge can still stop at PostgREST's 1,000-row cap on a Turretin card. That is a wrong count, not this slowness.

## Surprises (read these before the next session)

- Ecclesiastes 7 is 6 systematic hits and stays inline. Romans 8 is 189 and becomes one Turretin summary (188) plus Calvin's single hit. Expanding the summary loads the pointers.
- Turretin volumes have no recorded page images (the index was imported). The disclosure hides after an empty fetch. A book that does have images (Grounded in Heaven) shows the thumbs only after the disclosure opens.
- `title_sort_key` matches `titleSortKey` for the article fixtures, including "The City of God" sorting under C. Tie-break is `id`, so two equal keys no longer follow the old `paginateAll` order.

## Carry-forward updates

- [x] components.mdc updated
- [x] AGENTS.md inventory updated
- [x] new env vars documented (none)
- [x] tracker Open Questions updated (none — this was not a tracker session)
