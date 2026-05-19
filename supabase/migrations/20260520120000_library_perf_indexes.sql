-- Library list/detail/review hot-path indexes (perf pass 033).
-- Partial indexes keep btree small on live rows only.

create index if not exists idx_book_authors_person_id
  on book_authors (person_id);

create index if not exists idx_scripture_references_book_id_live
  on scripture_references (book_id, verse_start_abs)
  where deleted_at is null and book_id is not null;

create index if not exists idx_book_topics_book_id_live
  on book_topics (book_id)
  where deleted_at is null and book_id is not null;

create index if not exists idx_books_live_review
  on books (needs_review, id)
  where deleted_at is null;

create index if not exists idx_books_live_facets
  on books (genre, language, reading_status)
  where deleted_at is null;
